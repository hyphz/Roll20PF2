class Pathfinder2Utils {
    send(msg) {
        sendChat("PF2", msg);
    }

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

    safeGet(object, property) {
        if (typeof object.get === "function") {
            return object.get(property);
        } else {
            return null;
        }
    }

    selectedTokens(selected) {
        let realObjs = _.map(selected, (x) => getObj(x._type, x._id));
        let tokens = _.filter(realObjs, (x) => (x.get("_subtype") === "token"));
        return tokens;
    }

    abbreviate(name) {
        return name.replace(/ /g, "").toLowerCase();
    }

    dictToTemplate(title, dict) {
        let out = "&{template:default} {{name=" + title + "}} ";
        for (let key in dict) {
            if (dict.hasOwnProperty(key)) {
                out = out + "{{" + key + "=" + dict[key] + "}} ";
            }
        }
        return out;
    }

    getCharForToken(token) {
        if (token.get("represents") === "") {
            return null;
        }
        let charId = token.get("represents");
        let char = getObj("character", charId);
        return char;
    }

    getTokenName(token) {
        let char = this.getCharForToken(token);
        if (char !== null) return char.get("name");
        if (token.get("name") !== "") return token.get("name");
        return "(Unknown)";
    }

    getPageTokens() {
        let curPage = Campaign().get("playerpageid");
        let tokens = filterObjs(x => ((x.get("_subtype") === "token") && (x.get("_pageid") === curPage)));
        return tokens;
    }

    findTargetToken(specifier) {
        let canonSpec = this.abbreviate(specifier);
        let tokens = this.getPageTokens();
        let matches = [];
        for (let token of tokens) {
            let char = this.getCharForToken(token);
            if (char !== null) {
                if (canonSpec === "pcs") {
                    if (_.some(char.get("controlledby"),x => !playerIsGM(x))) {
                        matches.push(token);
                        continue;
                    }
                } else {
                    if (this.abbreviate(char.get("name")).startsWith(canonSpec)) {
                        matches.push(token);
                        continue;
                    }
                }

            }
            if (token.get("name") !== "") {
                if (this.abbreviate(token.get("name")).startsWith(canonSpec)) {
                    matches.push(token);
                    continue;
                }
            }
        }
        return matches;
    }

    getTurnOrder() {
        let strOrder = Campaign().get("turnorder");
        if (strOrder === "") {
            return [];
        } else {
            return JSON.parse(strOrder);
        }
    }

    d20() {
        return randomInteger(20);
    }


    getTokenAttr(token, property) {
        let char = this.getCharForToken(token);
        if (char === null) {
            return null;
        }
        let result = getAttrByName(char.id, property);
        return result;
    }


    doAbility(abilityString, freeSkill, targets) {
        let abspec = this.abbreviate(abilityString);
        let ability = _.find(this.abilities, x => this.abbreviate(x.name).startsWith(abspec));
        if (ability === undefined) {
            this.send("Unknown ability, " + abilityString);
            return;
        }
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
        let results = {};

        let skillreq = this.skillOrdinal(ability.reqprof);

        for (let target of targets) {
            let char = this.getCharForToken(target);
            let name = this.getTokenName(target);
            if (char === null) {
                results[name] = "(No sheet)";
                continue;
            }
            let skillLevel = this.getTokenAttr(target, skill + "_proficiency_display");
            if (skillLevel === undefined) {
                results[name] = "(Not on sheet)";
                continue;
            }
            if (this.skillOrdinal(skillLevel) < skillreq) {
                results[name] = "(Not qualified - " + skillLevel + ")";
                continue;
            }
            let modifier = this.getTokenAttr(target, skill);
            let numProp = parseInt(modifier);
            if (isNaN(numProp)) {
                results[name] = "(Invalid)";
            } else {
                let roll = this.d20();
                let out = roll + " + " + modifier + " = " + (roll + numProp) + " (" + skillLevel + ")";
                if (roll === 20) out += " (Critical)";
                if (roll === 1) out += " (Fumble)";
                results[name] = out;
            }
        }
        let header = ability.name;
        if (wasFreeSkill) header = header + " (" + freeSkill + ")";

        this.send(this.dictToTemplate(header, results));
        this.send(this.dictToTemplate(header, {
            "Critical": ability.crit, "Success": ability.hit,
            "Fail": ability.miss, "Fumble": ability.fumble
        }));
    }




    getProperty(property, targets) {
        let results = {};
        for (let target of targets) {
            let char = this.getCharForToken(target);
            let propertyValue = this.getTokenAttr(target, property);
            let name = this.getTokenName(target);

            if (propertyValue === null) {
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
                    let out = roll + " + " + propertyValue + " = " + (roll+propertyValue);
                    if (roll == 20) out += " (Critical)";
                    if (roll == 1) out += " (Fumble)";
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
            if (_.some(char.get("controlledby"), x => x === msg.playerid)) {
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
            fumble: "The target refuses, becomes hostile, and can't be coerced again for a week."
        }
        ];

    }
}

new Pathfinder2Utils();
log("Hyphz's Pathfinder 2 Utilities started");


