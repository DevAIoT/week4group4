# Group Project Overview

This directory contains the Arduino firmware, MCP server, and visualization assets
for the occupancy/gesture project.

## Directory structure

- `nano33_occupancy/`
  - Arduino sketch for the Nano 33 Sense Rev2.
  - Handles serial preprocessing input and emits gesture events.

- `Server/`
  - `server.py`: MCP server that reads gesture events, tracks occupancy,
    and exposes tools (including preprocessing via Arduino).
  - `test_mcp_tools.py`: MCP client test script for calling server tools.
  - `requirements.txt`: Python dependencies for the server and test script.
  - `results/`: output folder for preprocessed CSV files.
  - `CalIt2.data` / `CalIt2_net_occupancy.csv`: sample dataset and expected output.

- `visualization-test/`
  - Processing/visualization experiments.
  - `Heatmap/Heatmap.pde`: heatmap prototype.
