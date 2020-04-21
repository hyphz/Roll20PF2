/**
 * @typedef {Object} Roll20Object
 */

class Pathfinder2Utils {

    /**
     * Send a message to public chat with the script's name.
     * @param {String} msg The message to send
     */
    send(msg) {
        sendChat("PF2", msg);
    }

    /**
     * Checks if a string parameter is effectively absent via being null or blank.
     * @param str
     * @returns {boolean} True if the string is effectively null.
     */
    isAbsentString(str) {
        if (str === null) return true;
        if (str === undefined) return true;
        if (str === "") return true;
        return false;
    }

    /**
     * Return an ordinal number for the Pathfinder 2 skill proficiency letter specified.
     * @param {!String} letter The skill letter.
     * @returns {!number} An ordinal rank for the skill proficiency, with unknown valued defaulted to untrained.
     */

    skillOrdinal(letter) {
        switch(letter) {
            case "": return 0;
            case "U": return 0;
            case "T": return 1;
            case "E": return 2;
            case "M": return 3;
            case "L": return 4;
            default: return 0;
        }
    }

    /**
     * Standardise a skill proficiency letter read from a character sheet.
     * @param {!string} letter
     * @returns {!string}
     */
    standardiseSkillLetter(letter) {
        switch(letter) {
            case "": return "U";
            case "U": case "T": case "E": case "M": case "L":
                return letter;
            case "u": case "t": case "e": case "m": case "l":
                return letter.toUpperCase();
            default: return "U";
        }
        return "U";
    }

    /**
     * Get all tokens listed as selected on an input message.
     * @param selected The selected component of the input message.
     * @returns {Roll20Object[]} The list of selected tokens.
     */
    selectedTokens(selected) {
        let realObjs = selected.map((x) => getObj(x._type, x._id));
        let tokens = realObjs.filter((x) => (x.get("_subtype") === "token"));
        return tokens;
    }

    /**
     * Canonize a name by removing spaces and converting to lower case.
     * @param {!string} name The input name.
     * @returns {!string} The standardised name.
     */
    abbreviate(name) {
        return name.replace(/ /g, "").toLowerCase();
    }

    /**
     * Convert a dictionary to a string that produces a roll20 standard template showing members of that dict.
     * @param {string} title
     * @param {Object.<string,(string|number)>} dict The data to be included in the template.
     * @returns {string} The template string.
     */
    dictToTemplate(title, dict) {
        let out = "&{template:default} {{name=" + title + "}} ";
        for (let key in dict) {
            if (dict.hasOwnProperty(key)) {
                out = out + "{{" + key + "=" + dict[key] + "}} ";
            }
        }
        return out;
    }

    /**
     * Get the character a particular token represents.
     * @param {!Roll20Object} token The token.
     * @returns {?Roll20Object} The represented character, or null if no character represented.
     */
    getCharForToken(token) {
        if (token.get("represents") === "") {
            return null;
        }
        let charId = token.get("represents");
        let char = getObj("character", charId);
        return char;
    }


    /**
     * Get the name for a token, from its character or itself, or else an unknown placeholder.
     * @param {!Roll20Object} token The token.
     * @returns {!string} The name for the token.
     */
    getTokenName(token) {
        let char = this.getCharForToken(token);
        if (char !== null) {
            let charName = char.get("name");
            if (!this.isAbsentString(charName)) return charName;
        }
        if (!this.isAbsentString(token.get("name"))) return token.get("name");
        return "(Unknown)";
    }

    /**
     * Get all tokens on the active player page.
     * @returns {!Roll20Object[]} The list of all tokens.
     */
    getPageTokens() {
        let curPage = Campaign().get("playerpageid");
        let tokens = filterObjs(x => ((x.get("_subtype") === "token") && (x.get("_pageid") === curPage)));
        return tokens;
    }

    /**
     * Returns true if the token is controlled by someone other than the GM.
     * @param {!Roll20Object} token The token
     * @returns {!boolean} True the token represents a character controlled by a non-GM.
     */
    tokenIsPC(token) {
        let char = this.getCharForToken(token);
        if (char === null) return false;
        return (char.get("controlledby").some(x => !playerIsGM(x)));
    }


    /**
     * Find the tokens referred to by a fragment of a target specifier.
     * @param {!String} specifier The specifier
     * @returns {!Roll20Object[]} The tokens it likely refers to.
     */
    findTargetToken(specifier) {
        let canonSpec = this.abbreviate(specifier);
        let tokens = this.getPageTokens();
        let matches = [];
        for (let token of tokens) {
            if (canonSpec === "pcs") {
                if (this.tokenIsPC(token)) matches.push(token);
            } else {
                if (this.abbreviate(this.getTokenName(token)).startsWith(canonSpec)) matches.push(token);
            }
        }
        return matches;
    }

    /**
     * Reads the turn order.
     * @returns {!*[]}
     */

    getTurnOrder() {
        let strOrder = Campaign().get("turnorder");
        if (strOrder === "") {
            return [];
        } else {
            return JSON.parse(strOrder);
        }
    }

    /**
     * Rolls a d20 using the approved RNG.
     * @returns {!Number} A random number from 1-20.
     */
    d20() {
        return randomInteger(20);
    }

    /**
     * Get the named attribute value of the character represented by given token.
     * @param {!Roll20Object} token The token.
     * @param {string} property The name of the property.
     * @returns {null|string|number} The property value or null if it's missing.
     */
    getTokenAttr(token, property) {
        let char = this.getCharForToken(token);
        if (char === null) {
            return null;
        }
        let result = getAttrByName(char.id, property);
        return result;
    }


    /**
     * Carries out the named PF2 ability. This is the "ability" command.
     * @param {string} abilityString The user specification of the ability.
     * @param {string} freeSkill The user specification of the skill to be used for free skill abilities.
     * @param {Roll20Object[]} targets The list of targets.
     */
    doAbility(abilityString, freeSkill, targets) {
        // Find the ability in the ability list
        let abspec = this.abbreviate(abilityString);
        let ability = this.abilities.find(x => this.abbreviate(x.name).startsWith(abspec));
        if (ability === undefined) {
            this.send("Unknown ability, " + abilityString);
            return;
        }
        // If it's a free skill ability, user must specify the skill; otherwise, use the one from the ability
        // list
        let wasFreeSkill = false;
        let skill = "";
        if (ability.skill === "") {
            if (freeSkill === undefined) {
                this.send(ability.name + " is a free skill ability. Please specify the skill to use.");
                return;
            }
            wasFreeSkill = true;
            skill = freeSkill;
        } else {
            skill = ability.skill;
        }
        // Check for all targets..
        let results = {};
        let skillreq = this.skillOrdinal(ability.reqprof);
        for (let target of targets) {
            let char = this.getCharForToken(target);
            let name = this.getTokenName(target);
            if (char === null) {    // Target doesn't have a character sheet
                results[name] = "(No sheet)";
                continue;
            }
            // Get skill proficiency level to check proficiency prerequisite
            let skillLevel = this.getTokenAttr(target, skill + "_proficiency_display");
            if (skillLevel === undefined) {
                results[name] = "(Not on sheet)";
                continue;
            }
            if (this.skillOrdinal(skillLevel) < skillreq) {
                results[name] = "(Not qualified - " + this.standardiseSkillLetter(skillLevel) + ")";
                continue;
            }
            // All ok, do the roll
            let modifier = this.getTokenAttr(target, skill);
            let numProp = parseInt(modifier);
            if (isNaN(numProp)) {
                results[name] = "(Invalid)";
            } else {
                let roll = this.d20();
                let out = roll + " + " + modifier + " = [[" + (roll + numProp);
                if (roll === 20) out += "+d0cs0";
                if (roll === 1) out += "+d0cs1cf0";
                out += "]] (" + this.standardiseSkillLetter(skillLevel) + ")";

                results[name] = out;
            }
        }
        let header = ability.name;
        if (wasFreeSkill) header = header + " (" + freeSkill + ")";

        if (ability.tags.includes("Secret")) {
            this.send("(Rolled in secret.)");
            this.send("/w gm " + this.dictToTemplate(header, results));
        } else {
            this.send(this.dictToTemplate(header, results));

        }
        this.send(this.dictToTemplate(header, {
            "Critical": ability.crit, "Success": ability.hit,
            "Fail": ability.miss, "Fumble": ability.fumble
        }));
    }


    /**
     * Fetches a property value. This corresponds to the "get" command.
     * @param {string} property The user specification of the property name.
     * @param {Roll20Object[]} targets The target list.
     */
    getProperty(property, targets) {
        let results = {};
        for (let target of targets) {
            let char = this.getCharForToken(target);
            let propertyValue = this.getTokenAttr(target, property);
            let name = this.getTokenName(target);

            if (propertyValue == null) {
                results[name] = "(No sheet)";
            } else {
                results[name] = propertyValue;
            }
        }
        this.send(this.dictToTemplate("Get " + property, results));
    }

    rollProperty(property, targets) {
        let results = {};
        for (let target of targets) {
            let char = this.getCharForToken(target);
            let propertyValue = this.getTokenAttr(target, property);
            let name = this.getTokenName(target);

            if (propertyValue === null) {
                results[name] = "(No sheet)";
            } else {
                let numProp = parseInt(propertyValue);
                if (isNaN(numProp)) {
                    results[name] = "(Invalid)";
                } else {
                    let roll = this.d20();
                    let out = roll + " + " + propertyValue + " = [[" + (roll+propertyValue);
                    // Fudges to make rolled 20 and 1s have crit failure/success colouring in output
                    if (roll === 20) out += "+d0cs0";
                    if (roll === 1) out += "+d0cs1cf0";
                    out = out + "]]";
                    results[name] = out;
                }
            }
        }
        this.send(this.dictToTemplate("Roll " + property, results));
    }


    bestProperty(property, targets) {
        let bestName = "";
        let bestValue = -9999;
        for (let target of targets) {
            let value = this.getTokenAttr(target, property);
            if (value === null) continue;
            if (value > bestValue) {
                bestValue = value;
                bestName = this.getTokenName(target);
            }
        }
        if (bestValue === -9999) {
            this.send("No best " + property + " found.");
        } else {
            let results = {};
            results[bestName] = bestValue;
            this.send(this.dictToTemplate("Best " + property, results));

        }
    }


    getSpecifiedTargets(spec) {
        let targets = [];
        let targetNameList = spec.slice(1).split(",");
        for (let targetName of targetNameList) {
            let thisTargets = this.findTargetToken(targetName);
            targets = targets.concat(thisTargets);
        }
        return targets;
    }

    getInferredTargets(msg) {
        let selected = this.selectedTokens(msg.selected);
        if (selected !== null) return selected;
        if (playerIsGM(msg.playerid)) return [];
        let allTokens = this.getPageTokens();
        let possTokens = null;
        for (let token of allTokens) {
            let char = this.getCharForToken(token);
            if (char === null) continue;
            if (char.get("controlledby").some(x => x === msg.playerid)) {
                possTokens = possTokens.push(token);
            }
        }
        return possTokens;
    }



    message(msg) {
        if (msg.type === "api") {
            if (msg.content.startsWith("!pf")) {
                let parts = msg.content.split(" ");
                let command = parts[1];
                let targets = [];
                let firstParam = 2;

                if (command.startsWith("@")) {
                    targets = this.getSpecifiedTargets(command);
                    command = parts[2];
                    firstParam = 3;
                } else {
                    targets = this.getInferredTargets(msg);
                }

                if (targets.length === 0) {
                    this.send("No targets found.");
                    return;
                }


                if (command === "ability") {
                    this.doAbility(parts[firstParam], parts[firstParam+1], targets);
                    return;
                }
                if (command === "get") {
                    this.getProperty(parts[firstParam], targets);
                    return;
                }
                if (command === "best") {
                    this.bestProperty(parts[firstParam], targets);
                    return;
                }
                if (command === "roll") {
                    this.rollProperty(parts[firstParam], targets);
                    return;
                }
                this.send("Unknown command '" + command + "'.");
            }
        }
    }

    constructor() {

        on("chat:message", (msg) => this.message(msg));

        this.abilities = [{
            name: "Decipher Writing",
            tags: ["Concentrate","Exploration","Secret"],
            skill: "",
            reqprof: "T",
            crit: "You understand the true meaning of the text, even if it is in code.",
            hit: "You understand the true meaning of the text, but might not have a word-for-word translation if it is in code.",
            miss: "You don't understand the text. -2c to any further checks to decipher it.",
            fumble: "You think you understood the text but are wrong."
        }, {
            name: "Earn Income",
            tags: ["Downtime"],
            skill: "",
            reqprof: "T",
            crit: "You earn money at the task level +1.",
            hit: "You earn money at the given task level.",
            miss: "You earn the failure amount fo the task level.",
            fumble: "You earn nothing and are fired."
        }, {
            name: "Identify Magic",
            tags: ["Concentrate","Exploration","Secret"],
            skill: "",
            reqprof: "T",
            crit: "You learn all attributes of the magic.",
            hit: "You get a sense of what the magic does. No retry.",
            miss: "You can't identify the magic for 1 day.",
            fumble: "You misidentify the magic."
        }, {
            name: "Learn A Spell",
            tags: ["Concentrate","Exploration"],
            skill: "",
            reqprof: "T",
            crit: "You spend half the materials and learn the spell.",
            hit: "You spend the materials and learn the spell.",
            miss: "You expend no materials and can't learn the spell until you level.",
            fumble: "You expand half materials and can't learn the spell until you level."
        }, {
            name: "Recall Knowledge",
            tags: ["Concentrate","Secret"],
            skill: "",
            reqprof: "U",
            crit: "You recall accurate knowledge plus extra information.",
            hit: "You recall accurate knowledge.",
            miss: "You don't recall the information.",
            fumble: "You recall wrong information."
        }, {
            name: "Subsist",
            tags: ["Downtime"],
            skill: "",
            reqprof: "U",
            crit: "You provide subsistence living for 2, or comfortable for yourself.",
            hit: "You provide yourself a subsistence living.",
            miss: "You are fatigued until you get food and shelter.",
            fumble: "-2c to Subsist for 1 week and are in danger of hunger or thirst."
        }, {
            name: "Balance",
            tags: ["Move"],
            action: 1,
            skill: "acrobatics",
            reqprof: "U",
            crit: "Move up to your speed.",
            hit: "Move up to your speed as difficult terrain.",
            miss: "Lose the move action, or fall and end your turn.",
            fumble: "Fall and end your turn."
        }, {
            name: "Tumble Through",
            tags: ["Move"],
            action: 1,
            skill: "acrobatics",
            reqprof: "U",
            crit: "As success.",
            hit: "You move through an enemy's space, treating it as difficult terrain.",
            miss: "Your movement ends and you trigger reactions.",
            fumble: "As failure."
        }, {
            name: "Maneuver in Flight",
            tags: ["Move"],
            action: 1,
            skill: "acrobatics",
            reqprof: "T",
            crit: "As success.",
            hit: "You succeed at the maneuver.",
            miss: "The maneuver fails.",
            fumble: "The maneuver fails with dire consequnces."
        }, {
            name: "Squeeze",
            tags: ["Exploration", "Move"],
            skill: "acrobatics",
            reqprof: "T",
            crit: "You squeeze at 10' per min.",
            hit: "You squeeze at 5' per min.",
            miss: "You can't fit through.",
            fumble: "You get stuck. To escape, check again and get better than a fumble."
        }, {
            name: "Borrow An Arcane Spell",
            tags: ["Concentrate", "Exploration"],
            skill: "arcana",
            reqprof: "T",
            crit: "As success.",
            hit: "You prepare the borrowed spell.",
            miss: "You can't prepare the spell until next preparation, but keep the slot.",
            fumble: "As failure."
        }, {
            name: "Climb",
            tags: ["Move"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "You climb at 5' + a quarter your speed.",
            hit: "You climb at a quarter your speed.",
            miss: "You don't get anywhere.",
            fumble: "You fall, landing prone if on stable ground."
        }, {
            name: "Force Open",
            tags: ["Attack"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "You open the item without damaging it.",
            hit: "You open the item but break it.",
            miss: "You don't open the item.",
            fumble: "You jam the item. -2c on future attempts to force."
        }, {
            name: "Grapple",
            tags: ["Attack"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "Your opponent is restrained until end of your next turn.",
            hit: "Your opponent is grabbed until end of your next turn.",
            miss: "You fail to grab the opponent and release them if they were grabbed.",
            fumble: "Your target can grab you, or force you to fall prone."
        }, {
            name: "High Jump",
            tags: [],
            action: 2,
            skill: "athletics",
            reqprof: "U",
            crit: "Choose: 8' vertical, or 5' vertical and 10' horizontal.",
            hit: "5' vertical.",
            miss: "Leap normally.",
            fumble: "You fall prone in your space."
        }, {
            name: "Long Jump",
            tags: [],
            action: 2,
            skill: "athletics",
            reqprof: "U",
            crit: "As success.",
            hit: "You leap the target distance.",
            miss: "You leap normally.",
            fumble: "You leap normally but fall prone when you land."
        }, {
            name: "Shove",
            tags: ["Attack"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "Push the opponent up to 10' away, and can Stride after it.",
            hit: "Push the opponent 5' back, and can Stride after it.",
            miss: "You don't push the opponent.",
            fumble: "You fall prone."
        }, {
            name: "Swim",
            tags: ["Move"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "Swim 10' plus a quarter of your speed.",
            hit: "Swim 5' plus a quarter of your speed.",
            miss: "You don't get anywhere.",
            fumble: "You don't get anywhere and lose a round of air."
        }, {
            name: "Trip",
            tags: ["Attack"],
            action: 1,
            skill: "athletics",
            reqprof: "U",
            crit: "The target lands prone and takes [[1d6]] bludgeoning.",
            hit: "The target lands prone.",
            miss: "The target isn't bothered.",
            fumble: "You fall prone."
        }, {
            name: "Disarm",
            tags: ["Attack"],
            action: 1,
            skill: "athletics",
            reqprof: "T",
            crit: "You disarm the opponent.",
            hit: "Until their next turn, others Disarm them at +2c, and they attack or use the item at -2c.",
            miss: "You don't do anything.",
            fumble: "You fall prone."
        }, {
            name: "Repair",
            tags: ["Exploration", "Manipulate"],
            skill: "crafting",
            reqprof: "U",
            crit: "You repair 10 HP plus 10 HP per proficiency rank.",
            hit: "You repair 5 HP plus 5 HP per proficiency rank.",
            miss: "You don't repair the item.",
            fumble: "You deal [[2d6]] damage to the item."
        }, {
            name: "Craft",
            tags: ["Downtime", "Manipulate"],
            skill: "crafting",
            reqprof: "T",
            crit: "You make the item. Extra time reduces costs based on level+1.",
            hit: "You make the item. Extra times reduces costs based on level.",
            miss: "You don't make the item but you can salvage all the materials.",
            fumble: "You don't make the item but you can salvage 90% of the materials."
        }, {
            name: "Identify Alchemy",
            tags: ["Concentrate","Exploration","Secret"],
            skill: "crafting",
            reqprof: "T",
            crit: "As success.",
            hit: "You identify the item and its activation.",
            miss: "You don't identify the item.",
            fumble: "You misidentify the item."
        }, {
            name: "Create a Diversion",
            tags: ["Mental"],
            action: 1,
            skill: "deception",
            reqprof: "U",
            crit: "As success.",
            hit: "(per creature) You are hidden.",
            miss: "(per creature) You are not hidden and the creature knows you were trying to hide."
        }, {
            name: "Impersonate",
            tags: ["Concentrate", "Exploration", "Manipulate", "Secret"],
            skill: "deception",
            reqprof: "U",
            crit: "As success.",
            hit: "Target thinks you're who you're impersonating.",
            miss: "Target can tell you're not that person.",
            fumble: "Target can tell you're not that person and recognizes you if they know you."
        }, {
            name: "Lie",
            tags: ["Auditory","Concentrate","Linguistic","Mental","Secret"],
            skill: "deception",
            reqprof: "U",
            crit: "As success.",
            hit: "Target believes you.",
            miss: "The target doesn't believe to you and gains +4c against your lies.",
            fumble: "As failure."
        }, {
            name: "Deception",
            tags: ["Mental"],
            skill: "deception",
            reqprof: "T",
            action: 1,
            crit: "Target flat-footed against your melee until end of your next turn.",
            hit: "Target flat-footed against your next melee in the current turn.",
            miss: "The target isn't fooled.",
            fumble: "You are flat-footed against their melee until end of your next turn."
        }, {
            name: "Gather Information",
            tags: ["Exploration", "Secret"],
            skill: "diplomacy",
            reqprof: "U",
            crit: "As success.",
            hit: "You find information.",
            miss: "You don't find any information.",
            fumble: "You gather wrong information."
        }, {
            name: "Make an Impression",
            tags: ["Auditory", "Concentrate", "Exploration", "Linguistic", "Mental"],
            skill: "diplomacy",
            reqprof: "U",
            crit: "Attitude improves by 2 steps.",
            hit: "Attitude improves by 1 step.",
            miss: "Attitude doesn't change.",
            fumble: "Attitude worsens by 1 step."
        }, {
            name: "Request",
            tags: ["Auditory", "Concentrate", "Linguistic", "Mental"],
            skill: "diplomacy",
            reqprof: "U",
            crit: "The target agrees.",
            hit: "The target agrees with caveats.",
            miss: "The target refuses the request.",
            fumble: "The target refuses and their attitude worsens by 1 step."
        }, {
            name: "Coerce",
            tags: ["Auditory", "Concentrate", "Emotion", "Exploration", "Lingustic", "Mental"],
            skill: "intimidation",
            reqprof: "U",
            crit: "The target obeys, then becomes unfriendly but is too scared to retaliate.",
            hit: "The target obeys, then becomes unfriendly and may act against you.",
            miss: "The target refuses and becomes unfriendly.",
            fumble: "The target refuses, becomes hostile, and you can't coerce them again for a week."
        }, {
            name: "Demoralize",
            tags: ["Auditory", "Concentrate", "Emotion", "Mental"],
            skill: "intimidation",
            action: 1,
            reqprof: "U",
            crit: "The target is frightened 2. You can't demoralize them again for 10 minutes.",
            hit: "The target is frightened 1. You can't demoralize them again for 10 minutes.",
            miss: "The target isn't frightened. You can't demoralize them again for 10 minutes.",
            fumble: "As failure."
        }, {
            name: "Stabilize",
            tags: ["Manipulate"],
            skill: "medicine",
            action: 2,
            reqprof: "U",
            crit: "As success.",
            hit: "The target loses the dying condition.",
            miss: "The target's dying value increases by 1.",
            fumble: "As failure."
        }, {
            name: "Stop Bleeding",
            tags: ["Manipulate"],
            skill: "medicine",
            action: 2,
            reqprof: "U",
            crit: "As success.",
            hit: "The target attempts a flat check to end the bleeding.",
            miss: "The target immediately takes their persistent bleed damage.",
            fumble: "As failure."
        }, {
            name: "Treat Disease",
            tags: ["Downtime","Manipulate"],
            skill: "medicine",
            reqprof: "T",
            crit: "The target gets +4c to their next save against the disease.",
            hit: "The target gets +2c to their next save against the disease.",
            miss: "The target gets no benefit.",
            fumble: "The target gets -2c to their next save against the disease."
        }, {
            name: "Treat Poison",
            tags: ["Manipulate"],
            skill: "medicine",
            action: 1,
            reqprof: "T",
            crit: "The target gets +4c to their next save against the poison.",
            hit: "The target gets +2c to their next save against the poison.",
            miss: "The target gets no benefit.",
            fumble: "The target gets -2c to their next save against the poison."
        }, {
            name: "Treat Wounds",
            tags: ["Exploration","Healing","Manipulate"],
            skill: "medicine",
            reqprof: "T",
            crit: "The target heals [[4d8]] + difficulty bonus and is no longer wounded.",
            hit: "The target heals [[2d8]] + difficulty bonus and is no longer wounded.",
            miss: "The target is not healed.",
            fumble: "The target takes [[d8]] damage."
        }, {
            name: "Command an Animal",
            tags: ["Auditory", "Concentrate"],
            skill: "nature",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "The animal does what you ask.",
            miss: "The animal does nothing.",
            fumble: "The animal misbehaves."
        }, {
            name: "Perform",
            tags: ["Concentrate"],
            skill: "performance",
            reqprof: "U",
            action: 1,
            crit: "Your performance is impressive.",
            hit: "Your performance is appreciable.",
            miss: "Your performance is unsuccessful.",
            fumble: "Your performance is degrading."
        }, {
            name: "Create Forgery",
            tags: ["Downtime","Secret"],
            skill: "society",
            reqprof: "T",
            crit: "As success.",
            hit: "The observer does not detect the forgery.",
            miss: "The observer detects the forgery.",
            fumble: "As failure."
        }, {
            name: "Conceal an Object",
            tags: ["Manipulate","Secret"],
            skill: "stealth",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "Observers succeeded against do not casually notice the object.",
            miss: "Observers succeeded against notice the object.",
            fumble: "As failure."
        }, {
            name: "Hide",
            tags: ["Secret"],
            skill: "stealth",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "You become Hidden instead of Observed.",
            miss: "You remain Observed.",
            fumble: "As failure."
        }, {
            name: "Sneak",
            tags: ["Move", "Secret"],
            skill: "stealth",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "You remained undetected during your move.",
            miss: "You become Hidden during your move.",
            fumble: "If you can be detected, you're observed during your move. Otherwise, as failure."
        }, {
            name: "Sense Direction",
            tags: ["Exploration", "Secret"],
            skill: "survival",
            reqprof: "U",
            crit: "You know where you are and exactly where cardinal directions are.",
            hit: "You don't get lost and have a sense of the cardinal directions.",
            miss: "You can't work anything out.",
            fumble: "As failure."
        }, {
            name: "Track",
            tags: ["Concentrate", "Exploration", "Move"],
            skill: "survival",
            reqprof: "T",
            action: 1,
            crit: "As success.",
            hit: "You successfully find or follow the trail.",
            miss: "You lose the trail for 1 hour.",
            fumble: "You lose the trail for 24 hours."
        }, {
            name: "Palm an Object",
            tags: ["Manipulate"],
            skill: "thievery",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "You're not noticed palming the object.",
            miss: "You're noticed palming the object",
            fumble: "As failure."
        }, {
            name: "Steal",
            tags: ["Manipulate"],
            skill: "thievery",
            reqprof: "U",
            action: 1,
            crit: "As success.",
            hit: "You take the object and aren't noticed.",
            miss: "You fail to take the object, or are noticed taking it.",
            fumble: "As failure."
        }, {
            name: "Disable a Device",
            tags: ["Manipulate"],
            skill: "thievery",
            reqprof: "T",
            action: 2,
            crit: "You disable the device with no trace of doing so, or earn 2 successes.",
            hit: "You disable the device, or earn 1 success.",
            miss: "You don't disable the device.",
            fumble: "You trigger the device."
        }, {
            name: "Pick a Lock",
            tags: ["Manipulate"],
            skill: "thievery",
            reqprof: "T",
            action: 2,
            crit: "You unlock the lock with no trace of tampering, or earn 2 successes.",
            hit: "You unlock the lock, or earn 1 success.",
            miss: "You don't unlock the lock.",
            fumble: "You break your thieves' tools."
        }, {
            name: "Seek",
            tags: ["Concentrate","Secret"],
            skill: "perception",
            reqprof: "U",
            action: 1,
            crit: "A creature becomes observed. You know where an object is.",
            hit: "An undetected creature becomes hidden, a hidden creature becomes observed. You get a clue as to where an object is.",
            miss: "You don't detect anything.",
            fumble: "As failure.",
        }, {
            name: "Sense Motive",
            tags: ["Concentrate", "Secret"],
            skill: "perception",
            reqprof: "U",
            action: 1,
            crit: "You know the creature's true intentions, and if magic is affecting it.",
            hit: "You know if the creature is behaving normally or not.",
            miss: "You believe they're behaving normally and not being deceptive.",
            fumble: "You get the wrong idea about the their intentions."
        }
        ];

    }
}

new Pathfinder2Utils();
log("Hyphz's Pathfinder 2 Utilities started");


