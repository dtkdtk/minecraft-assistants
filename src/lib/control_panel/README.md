# Here - everything that relates to the bot control panel (CLI, command line interface)

Note: this refers to the *current* bot.

### DEV notes:

- About input handling (stdin: keypress, readline: line): Use ONLY handlers controlled by (dialog windows).
Creating other handlers *directly* can lead to unexpected consequences.
- EVERYTHING should be formatted as dialog windows. For any input interception and for any interactive commands (not those where "entered a command - got a result"), use dialog windows.
