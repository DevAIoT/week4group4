import argparse
import asyncio
import os
from pathlib import Path
import sys

from fastmcp import Client


def _result_value(result):
    if hasattr(result, "data"):
        return result.data
    return result


async def run_tests(args: argparse.Namespace) -> None:
    server_path = Path(__file__).with_name("server.py")
    env = os.environ.copy()
    if args.port:
        env["ARDUINO_PORT"] = args.port
    if args.baud:
        env["ARDUINO_BAUD"] = str(args.baud)

    cmd_args = [str(server_path)]
    if args.port:
        cmd_args.extend(["--port", args.port])
    if args.baud:
        cmd_args.extend(["--baud", str(args.baud)])

    config = {
        "mcpServers": {
            "local": {
                "command": sys.executable,
                "args": cmd_args,
                "env": env,
            }
        }
    }

    client = Client(config)
    async with client:
        tools = await client.list_tools()
        tool_names = {tool.name for tool in tools}

        def pick(name: str) -> str:
            if name in tool_names:
                return name
            prefixed = f"local_{name}"
            if prefixed in tool_names:
                return prefixed
            raise RuntimeError(f"Tool not found: {name}")

        get_occ = pick("get_current_occupancy")
        reset_occ = pick("reset_current_occupancy")
        preprocess = pick("preprocess_occupancy_data")

        status_tool = pick("get_serial_status")
        res = await client.call_tool(status_tool, {})
        print(_result_value(res))
        res = await client.call_tool(get_occ, {})
        print(_result_value(res))
        res = await client.call_tool(reset_occ, {})
        print(_result_value(res))
        res = await client.call_tool(get_occ, {})
        print(_result_value(res))
        if args.preprocess:
            res = await client.call_tool(
                preprocess,
                {"input_path": args.preprocess},
            )
            print(_result_value(res))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MCP client tests for tools in server.py"
    )
    parser.add_argument(
        "--preprocess",
        default=None,
        help="Path to raw flow CSV to preprocess via Arduino",
    )
    parser.add_argument(
        "--port",
        default=None,
        help="Optional serial port override (sets ARDUINO_PORT)",
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=None,
        help="Optional serial baud override (sets ARDUINO_BAUD)",
    )
    args = parser.parse_args()
    asyncio.run(run_tests(args))


if __name__ == "__main__":
    main()
