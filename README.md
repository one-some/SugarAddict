# SugarAddict
Userscript tool for editing the state of SugarCube games.

### Notes
- This script has only been tested with Violentmonkey, but other userscript managers will probably work
- This script runs on every page, as games can be on any domain. The script errors and closes upon not finding SugarCube, but if you don't want it running regardless, you can either edit the `@match` metadata field or disable the script.

## Features
- Variable editing (including complicated-ish things like nested objects and arrays and such)
- Passage jump
- Passage code viewer

## Maybe future features (maybe)
- "Capture variable changes" (think Cheat Engine) -- for now changes are outputted in the console.
- Syntax highlighting in code viewer
- Passage editing in code viewer
- Check patching in code viewer
- Click variable in code viewer to jump to it in variable editor
- Passage content search
- Open specific passage in code viewer
- Resizable window
- Better support for different versions and configurations, currently game compatibility isn't the best

I'm pretty bored with this so I frankly doubt any of this stuff will be implemented

## Screenshots
![image](https://user-images.githubusercontent.com/69319754/209257183-6ab03680-c8bb-493f-8f7e-252b510f1882.png)
![image](https://user-images.githubusercontent.com/69319754/209257258-2170fe96-61a1-4107-8eca-0bc3b44d6e2c.png)
![image](https://user-images.githubusercontent.com/69319754/209257402-4477bd0f-2cb3-45ea-b3c7-976eeeac7315.png)
