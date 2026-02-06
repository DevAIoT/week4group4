import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from fastmcp import Client

def _result_value(result):
    if hasattr(result, "data"):
        return result.data
    return result

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tool", required=True)
    ap.add_argument("--args", default="{}")
    ap.add_argument("--port", default=None)
    ap.add_argument("--baud", default=None)
    args = ap.parse_args()

    # server.py is expected alongside this file. If it's missing, run a lightweight
    # local stub so the web UI and dev flows continue to work without hardware.
    server_path = Path(__file__).resolve().with_name("server.py")
    if not server_path.exists():
        # Simple stubbed implementations for common tools used by the UI.
        tool_args = json.loads(args.args)

        def stub_get_serial_status():
            return {
                "port": args.port or None,
                "baud": args.baud or None,
                "connected": False,
                "error": "server.py not found; running stubbed MCP",
            }

        def stub_get_current_occupancy():
            return {"occupancy": 0, "timestamp": None}

        def stub_reset_current_occupancy():
            return {"ok": True}

        def stub_get_building_statistics():
            return {"building": tool_args.get("building"), "summary": {"count": 0}}

        def stub_preprocess_occupancy_data():
            return {"result_path": None, "note": "stub mode - no file processed"}

        stubs = {
            "get_serial_status": stub_get_serial_status,
            "get_current_occupancy": stub_get_current_occupancy,
            "reset_current_occupancy": stub_reset_current_occupancy,
            "get_building_statistics": stub_get_building_statistics,
            "preprocess_occupancy_data": stub_preprocess_occupancy_data,
        }

        if args.tool in stubs:
            out = stubs[args.tool]()
            print(json.dumps({"ok": True, "tool": args.tool, "output": out}, ensure_ascii=False))
            return
        else:
            print(json.dumps({"ok": False, "error": f"server.py not found and no stub for tool {args.tool}"}))
            sys.exit(1)

    env = os.environ.copy()
    if args.port:
        env["ARDUINO_PORT"] = args.port
    if args.baud:
        env["ARDUINO_BAUD"] = str(args.baud)

    # Spawn MCP server via stdio (simple + reliable for dev)
    config = {
        "mcpServers": {
            "local": {
                "command": sys.executable,
                "args": [str(server_path)],
                "env": env,
            }
        }
    }

    client = Client(config)

    tool_args = json.loads(args.args)

    async with client:
        tools = await client.list_tools()
        tool_names = {t.name for t in tools}

        tool_name = args.tool
        if tool_name not in tool_names:
            prefixed = f"local_{tool_name}"
            if prefixed in tool_names:
                tool_name = prefixed
            else:
                raise RuntimeError(f"Tool not found: {tool_name}. Available: {sorted(tool_names)}")

        res = await client.call_tool(tool_name, tool_args)
        out = _result_value(res)

        # Always emit JSON
        print(json.dumps({"ok": True, "tool": tool_name, "output": out}, ensure_ascii=False))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)