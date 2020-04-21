# Roll20PF2
Pathfinder 2 API utilities for Roll20

This is a set of utilities I found useful for running Pathfinder 2 in Roll20.

To use, currently you must cut and paste the entire `script.js` file into a new tab on the **API Settings** page.  This requires you to have a Pro Roll20 account.

## Functions

All commands start with `!pf`.

To choose the character(s) or token(s) affected by the command, the following rules are used:

* You can manually specify a target by placing an `@` after the `!pf` giving an initial part of the character name in lower case with spaces removed. For example, a character named *Ed Goblin* would be targeted by `!pf @edgoblin` or just `!pf @edgo`. Tokens that don't represent characters are matched based on their token name.
* You can target all PCs by specifying `!pf @pcs`.
* You can specify several targets by seperating them with commas; eg `!pf @pcs,edgo` will target all PCs and Ed Goblin (assuming Ed Goblin is not a PC)
* If you don't manually specify a target, the selected token(s) are targeted.
* If you don't manually specify a target and no tokens are selected, and you are not the GM, all tokens you control are targeted.

After the target specification (if there is one), should come the command followed by parameters separated by spaces. The available commands are as follows:

* `get <item>` reads the given number from the character sheet. Eg, `!pf @pcs get stealth` will display the Stealth values for all PCs. This can be used for any property on the character sheet.
* `best <item>` finds the highest number in listed character sheets and reports who has it. Eg, `!pf @pcs best perception` will find the PC with the best perception and print their score.
* `roll <item>` acts like `get` but adds a d20 roll to the given values.
* `ability <ability> <skill>` uses one of the standard Abilities from the Pathfinder 2 core rules. The ability is named in the same way as a target character - the start of the name in lower case, with no spaces.  This will roll the appropriate skill on the target(s), send the roll to the player or the GM if appropriate (the GM only if the ability has the Secret tag), and also print out a summary table of the effects of hitting different success thresholds. If the ability is one where different skills can be specified, the skill to use is specified as the second parameter. For example, if Ed Goblin wants to sneak, you can enter `!pf @edgo ability sneak`. If he's trying to remember a spell, you can enter `!pf @edgo ability recall arcana`.



## Known Abilities

Most of the abilities from the skills section are included, plus the two "standard" abilities which require skill rolls (*Sense Motive* and *Seek*). Note that abilities that don't require rolls can't be usefully managed and so are not included. This includes *Cover Tracks* which has no actual roll in the book. *Strike* and other attacks are also not included due to their significant modifier stacks. The two different versions of *Perform First Aid* are treated as two different abilities named *Stabilize* and *Stop Bleeding*.

| Ability | Note |
| -- | -- |
| Balance |
| Borrow an Arcane Spell | |
| Climb | | 
| Coerce | |
| Command an Animal | |
| Conceal an Object | Secret | 
| Craft | |
| Create a Diversion | |
| Create Forgery | Secret |
| Decipher Writing | Secret, must specify skill |
| Demoralize | |
| Disarm | (an opponent, not a trap) |
| Disable Device | |
| Earn Income | Must specify skill |
| Feint | | 
| Force Open | | 
| Gather Information | |
| Grapple | | 
| Hide | Secret | 
| High Jump | | 
| Identify Alchemy | Secret |
| Identify Magic | Secret, must specify skill |
| Impersonate | Secret |
| Learn A Spell | Must specify skill |
| Lie | Secret |
| Long Jump | |
| Maneuver in Flight | |
| Palm an Object | |
| Perform | |
| Pick a Lock | | 
| Recall Knowledge | Secret, must specify skill |
| Repair | | 
| Request | |
| Seek | Secret |
| Sense Direction | Secret |
| Sense Motive | Secret |
| Shove | |
| Sneak | Secret |
| Squeeze | |
| Stabilize | |
| Steal | |
| Stop Bleeding | |
| Subsist | Must specify skill |
| Swim | |
| Track | | 
| Treat Disease | |
| Treat Poison | |
| Treat Wounds | |
| Trip | | 
| Tumble Through | | 







