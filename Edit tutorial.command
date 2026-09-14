#!/bin/bash
# Double-click this file.
#   1. opens getting-started.txt in your text editor
#   2. shows the page in Safari
#   3. rebuilds the page every time you save the text (refresh Safari with Cmd+R)
# Close this window, or press Ctrl+C in it, when you are done.
cd "$(dirname "$0")" || exit 1
python3 tools/build_page.py
open -t getting-started.txt
open -a Safari getting-started.html
python3 tools/build_page.py --watch
