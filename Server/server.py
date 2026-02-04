
from mcp.server.fastmcp import FastMCP
import pandas as pd
import os
import sys
import threading
import time
from typing import Optional
from pathlib import Path
import queue
import argparse

import serial

mcp = FastMCP("Campus Crowd Analyzer")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")

_arg_parser = argparse.ArgumentParser(add_help=False)
_arg_parser.add_argument("--port", dest="arduino_port")
_arg_parser.add_argument("--baud", dest="arduino_baud")
_parsed_args, _ = _arg_parser.parse_known_args()

SERIAL_PORT = _parsed_args.arduino_port or os.environ.get("ARDUINO_PORT", "/dev/ttyACM0")
SERIAL_BAUD = int(_parsed_args.arduino_baud or os.environ.get("ARDUINO_BAUD", "230400"))

GESTURE_LEFT = 0
GESTURE_RIGHT = 1


class GestureCounter:
    def __init__(self) -> None:
        self._left = 0
        self._right = 0
        self._present = 0
        self._lock = threading.Lock()

    def update(self, gesture_code: Optional[int]) -> None:
        if gesture_code is None:
            return
        with self._lock:
            if gesture_code == GESTURE_LEFT:
                self._left += 1
                self._present = max(0, self._present - 1)
            elif gesture_code == GESTURE_RIGHT:
                self._right += 1
                self._present += 1

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "left": self._left,
                "right": self._right,
                "present": self._present,
            }

    def reset(self) -> None:
        with self._lock:
            self._left = 0
            self._right = 0
            self._present = 0


gesture_counter = GestureCounter()


class SerialManager:
    def __init__(self, port: str, baud: int) -> None:
        self._port = port
        self._baud = baud
        self._queue: queue.Queue[str] = queue.Queue()
        self._lock = threading.Lock()
        self.error: Optional[str] = None
        self._ser: Optional[serial.Serial] = None
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def _read_loop(self) -> None:
        try:
            self._ser = serial.Serial(self._port, self._baud, timeout=0.5)
            time.sleep(1.5)
            self._ser.reset_input_buffer()
            while True:
                raw = self._ser.readline()
                if not raw:
                    continue
                line = raw.decode(errors="replace").strip()
                if not line:
                    continue
                if line.startswith("GESTURE="):
                    try:
                        code = int(line.split("=", 1)[1].strip())
                    except Exception:
                        code = None
                    gesture_counter.update(code)
                else:
                    self._queue.put(line)
        except Exception as exc:
            self.error = f"Serial error: {exc}"

    def _drain_queue(self) -> None:
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break

    def _send_and_wait_ack(self, line: str, timeout_s: float) -> list[str]:
        if not self._ser:
            raise RuntimeError("Serial port not initialized")
        if not line.endswith("\n"):
            line = line + "\n"
        self._ser.write(line.encode("utf-8"))
        collected: list[str] = []
        start = time.time()
        while True:
            remaining = timeout_s - (time.time() - start)
            if remaining <= 0:
                raise TimeoutError("Timed out waiting for ACK from Arduino")
            try:
                msg = self._queue.get(timeout=remaining)
            except queue.Empty:
                continue
            if msg == "ACK":
                return collected
            collected.append(msg)

    def preprocess_file(self, input_path: Path, ack_timeout_s: float = 2.0) -> list[str]:
        if self.error:
            raise RuntimeError(self.error)
        if not self._ser:
            raise RuntimeError("Serial port not initialized")
        with self._lock:
            self._drain_queue()
            collected: list[str] = []
            collected.extend(self._send_and_wait_ack("RESET", ack_timeout_s))
            for line in input_path.read_text().splitlines():
                line = line.strip()
                if not line:
                    continue
                collected.extend(self._send_and_wait_ack(line, ack_timeout_s))
            collected.extend(self._send_and_wait_ack("FLUSH", ack_timeout_s))
            return collected


serial_manager = SerialManager(SERIAL_PORT, SERIAL_BAUD)

def load_data(building_name: str) -> pd.DataFrame:

    file_name = ""
    if building_name.lower() == "calit2":
        file_name = "CalIt2_net_occupancy.csv"
    else:
        file_name = f"{building_name}.csv"

    file_path = os.path.join(BASE_DIR, file_name)
   
    if not os.path.exists(file_path):
        return pd.DataFrame()

    try:
        df = pd.read_csv(file_path)
        df.columns = [c.strip().lower() for c in df.columns]
        return df
    except Exception as e:
        sys.stderr.write(f"Error reading {file_name}: {str(e)}\n")
        return pd.DataFrame()

@mcp.tool()
def get_building_statistics(building: str, date: str, start_time: str = None, end_time: str = None) -> str:
    """
    Queries occupancy data for a specific building on a specific date.
   
    Args:
        building: Name (e.g., 'Building_01', 'CalIt2').
        date: 'MM/DD/YY' (e.g., '07/24/05').
        start_time: 'HH:MM:SS' (optional).
        end_time: 'HH:MM:SS' (optional).
    """
   
    df = load_data(building)
    if df.empty:
        return f"Error: Could not find data for '{building}'."

    if 'date' not in df.columns:
         return f"Error: CSV format incorrect. Expected 'date' column."

    daily_data = df[df['date'].astype(str) == date]
    if daily_data.empty:
        return f"No data found for {building} on {date}."

    result_data = daily_data
    if start_time and end_time:
        result_data = daily_data[
            (daily_data['time'] >= start_time) &
            (daily_data['time'] <= end_time)
        ]

    if result_data.empty:
        return f"No data found between {start_time} and {end_time}."

    if 'occupancy' not in result_data.columns:
        return "Error: Column 'occupancy' not found."

    occupancy_series = pd.to_numeric(result_data['occupancy'], errors='coerce').fillna(0)
   
    occupancy_series = occupancy_series.clip(lower=0)
   
    avg_occupancy = occupancy_series.mean()
    max_occupancy = occupancy_series.max()
    min_occupancy = occupancy_series.min()
    total_count = occupancy_series.sum()
   
    if not occupancy_series.empty:
        max_idx = occupancy_series.idxmax()
        peak_time_str = result_data.loc[max_idx, 'time']
    else:
        peak_time_str = "N/A"

    summary = (
        f"--- Data Report: {building} ---\n"
        f"Date: {date}\n"
        f"Time Range: {start_time if start_time else 'Full Day'} to {end_time if end_time else 'End of Day'}\n"
        f"Total Count (Sum): {int(total_count)}\n"  
        f"Average Occupancy: {avg_occupancy:.1f}\n"
        f"Peak Occupancy: {max_occupancy} at {peak_time_str}\n"
        f"Minimum Occupancy: {min_occupancy}\n"
        f"Data Points: {len(result_data)}\n"
    )
   
    return summary


@mcp.tool()
def get_current_occupancy() -> str:
    """
    Returns current occupancy count based on gesture events from Arduino.
    """
    if serial_manager.error:
        return serial_manager.error
    snapshot = gesture_counter.snapshot()
    return (
        f"Current occupancy: {snapshot['present']} "
        f"(left={snapshot['left']}, right={snapshot['right']})"
    )


@mcp.tool()
def reset_current_occupancy() -> str:
    """
    Resets the gesture-based occupancy counters to zero.
    """
    gesture_counter.reset()
    return "Occupancy counters reset to zero."


@mcp.tool()
def get_serial_status() -> str:
    """
    Returns current serial configuration and any connection error.
    """
    error = serial_manager.error or "None"
    return f"Serial port: {SERIAL_PORT}, baud: {SERIAL_BAUD}, error: {error}"




@mcp.tool()
def preprocess_occupancy_data(input_path: str) -> str:
    """
    Preprocesses raw flow data and saves occupancy CSV in the results folder.
    """
    src_path = Path(input_path).expanduser()
    if not src_path.exists():
        return f"Error: input file not found: {src_path}"

    try:
        raw_lines = serial_manager.preprocess_file(src_path)
    except Exception as exc:
        return f"Error: preprocessing failed: {exc}"

    os.makedirs(RESULTS_DIR, exist_ok=True)
    out_path = Path(RESULTS_DIR) / f"{src_path.stem}_preprocessed.csv"
    csv_lines = [line for line in raw_lines if line.count(",") >= 2 and not line.startswith("ERR=")]
    if not csv_lines or not csv_lines[0].startswith("date,time,occupancy"):
        csv_lines.insert(0, "date,time,occupancy")
    try:
        out_path.write_text("\n".join(csv_lines) + "\n")
    except Exception as exc:
        return f"Error: failed to save output: {exc}"

    return str(out_path)

if __name__ == "__main__":
    mcp.run()
