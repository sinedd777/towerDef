# Element TD Tower Combinations

## Tier 1 – Single-Element Towers (6)

| Element | Tower Name        | Description                                       |
|---------|-------------------|---------------------------------------------------|
| Fire    | **Flame Spitter** | Short-range burst of flame; high DPS, no crowd control. |
| Water   | **Frost Sprayer** | Medium-range spray that slows enemies on hit.     |
| Nature  | **Vine Snare**    | Long-range snare shot that roots enemies for 1s.  |
| Light   | **Laser Beacon**  | Precision laser beam; pierces targets, high single-target damage. |
| Dark    | **Shadow Caster** | Launches a curse orb that leeches health over time. |
| Earth   | **Rock Launcher** | Hurls boulders with splash damage in a small radius. |

## Tier 2 – Dual-Element Towers (15)

| Combo                    | Tower Name            | Effect Highlights                                        |
|--------------------------|-----------------------|----------------------------------------------------------|
| Fire + Water             | **Steam Turbine**     | Mid-range steam blast; moderate damage + 25% slow.       |
| Fire + Nature            | **Blight Burner**     | Poisonous flame; damage over time in an AOE.             |
| Fire + Light             | **Solar Flare**       | Charges a blinding flare; stuns enemies briefly.         |
| Fire + Dark              | **Hellfire Grimoire** | Curse-infused fireball; pierces and burns over time.     |
| Fire + Earth             | **Magma Mortar**      | Launches molten rocks; large AOE on impact.              |
| Water + Nature           | **Swamp Mist**        | Mist cloud; slows and damages enemies over time.         |
| Water + Light            | **Prismatic Beam**    | High-velocity beam; extra damage to “dark” enemies.      |
| Water + Dark             | **Abyssal Torrent**   | Dark waters; heavy slow + leech healing to tower.        |
| Water + Earth            | **Mud Cannon**        | Shoots mud balls; high slow, low damage.                 |
| Nature + Light           | **Sunblade Grove**    | Emits solar-charged vines; moderate damage & stun.       |
| Nature + Dark            | **Deathbloom**        | Necrotic vines; high DOT and small fear effect.          |
| Nature + Earth           | **Thorn Fortress**    | Erupting brambles; spikes damage nearby creeps.          |
| Light + Dark             | **Void Prism**        | Fires dark laser; high raw damage, ignores armor.        |
| Light + Earth            | **Luminescent Obelisk** | Beacon that buffs nearby towers’ fire rate.           |
| Dark + Earth             | **Grave Quake**       | Quakes ground with shadow force; large AOE stun.         |

## Tier 3 – Triple-Element Towers (20)

| Combo                             | Tower Name                | Effect Highlights                                           |
|-----------------------------------|---------------------------|-------------------------------------------------------------|
| Fire + Water + Nature             | **Geyser of Decay**       | Erupts scalding poison geysers; heavy DOT & slow.           |
| Fire + Water + Light              | **Photon Steam Cannon**   | Charged steam-laser shots; splash + pierce.                |
| Fire + Water + Dark               | **Infernal Tide**         | Waves of hellish steam; massive AOE, fear effect.          |
| Fire + Water + Earth              | **Volcanic Spout**        | Throws magma fountains; continuous AOE fire.               |
| Fire + Nature + Light             | **Radiant Emberwood**     | Glowing vines of fire; burn + heal nearby towers.          |
| Fire + Nature + Dark              | **Cursed Wildfire**       | Hell-infused wildfire; spreads between enemies.            |
| Fire + Nature + Earth             | **Pyroclastic Bloom**     | Exploding bramble bombs; massive area devastation.         |
| Fire + Light + Dark               | **Eclipse Cannon**        | Dark sunbeam; extreme single-target damage.                |
| Fire + Light + Earth              | **Solar Caldera**         | Charging sun-rock orbs; slow projectiles with AOE.         |
| Fire + Dark + Earth               | **Obsidian Cataclysm**     | Shatters earth with cursed flames; stun + burn.            |
| Water + Nature + Light            | **Life Prism**            | Heals and boosts towers; occasional damage beam.           |
| Water + Nature + Dark             | **Necroquagmire**         | Swamp of death; high slow + DOT + leech.                   |
| Water + Nature + Earth            | **Quagmire Pillar**       | Summons mud pillars that block and slow heavily.           |
| Water + Light + Dark              | **Abyssal Radiance**      | Dark photon torrent; pierce + high critical chance.        |
| Water + Light + Earth             | **Hydro Beacon**          | Pulsing water-light orbs; chain slow + minor damage.       |
| Water + Dark + Earth              | **Mire of Despair**       | Pools of haunted water; heavy slow + curse.                |
| Nature + Light + Dark             | **Twilight Grove**        | Vines of dawn & dusk; stun + DOT.                          |
| Nature + Light + Earth            | **Verdant Spire**         | Growth pillar; buffs towers + shoots seed projectiles.     |
| Nature + Dark + Earth             | **Rotting Monolith**      | Deadwood golem spawns; tanky unit that taunts.             |
| Light + Dark + Earth              | **Celestial Rupture**     | Meteor of dark light; massive AOE & stun.                  |

## Combination & Upgrade Flow

1. **Tier 1 unlocks** at your first element pick (wave 5): choose any of the 6 elements → unlock that single-element tower.  
2. **Tier 2 becomes available** once you have **two** elements and meet the upgrade cost/wave requirement → upgrade any Tier 1 tower whose element matches one of your picks into the corresponding dual-element tower.  
3. **Tier 3 requires** **three** elements → upgrade a Tier 2 tower that uses two of your elements with the third to form the unique triple-element tower.  

```js
// Example tower data schema
const towerData = {
  single: [
    { elements: ['Fire'], name: 'Flame Spitter', cost: 100, ... },
    // ...
  ],
  dual: [
    { elements: ['Fire', 'Water'], name: 'Steam Turbine', cost: 250, ... },
    // ...
  ],
  triple: [
    { elements: ['Fire', 'Water', 'Nature'], name: 'Geyser of Decay', cost: 600, ... },
    // ...
  ],
};
```
