# Lastlight

A voxel survival game that runs in the browser. The sun is dying: every night lasts a little longer than the one before, and gloomlings crawl out of the dark. Build, explore three dimensions and rekindle the dawn.

**Play:** https://pawelinohd.github.io/lastlight/ (desktop browser with mouse and keyboard)

## What's in it

- Procedural world with six biomes (Meadowlands, Rosewood, Pinefrost, Ashlands, Mirelands, Shardfields), caves and ores
- Two more dimensions: **the Gloam** (a cold cave world of giant glowing mushrooms) and **Skyreach** (floating islands with low gravity)
- Warmth instead of hunger: stay near fire and light, or freeze
- Crafting with a Tinker's Bench and Kiln, four tool tiers, armor, a silk glider
- Ruins with loot caches and lost blueprints, a ruin compass
- Levels and perks, daily bounties, feats, farming, storage chests
- Umbral Nights every fourth night, with Gloom Brutes that smash your lanterns
- A final boss, the Umbral Maw, at the Dawn Altar in Skyreach
- Everything (textures, sounds, music) is generated in code; the only dependency is three.js

## Controls

`WASD` move · `Shift` sprint · `Space` jump/swim/glide · left mouse mine/attack · right mouse place/use/eat · `E` pack & crafting · `J` journal · `Q` drop · `1-9` hotbar · `T` chat · `Tab` players · `Esc` menu

## Multiplayer

Multiplayer needs the small Node server in this repo (no npm packages required):

```
node server.js            # LAN: friends open http://<your-ip>:8840
node online.js            # internet: needs tools/cloudflared.exe, prints a public link
```

The world is saved to `world.json`. Each player's inventory and progress are saved on the server under their name.

## Run locally

Open `index.html` in a browser, or run `node server.js` and open http://localhost:8840.
