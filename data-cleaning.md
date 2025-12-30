# Data Cleaning

This document captures the data cleaning and standardization work performed on the VGC usage database.
Overview

The database contained scraped data from multiple sources (RK9.gg and Limitless TCG API), requiring extensive data cleaning to ensure consistency and accurate analysis.
Issues Identified and Fixed

## Species vs Form Structure

Problem: Many Pokemon with multiple forms were stored as separate species (e.g., "Wellspring Mask Ogerpon", "Rapid Strike Urshifu")
Solution: Restructured to use proper species + form model

- All forms now use species = base Pokemon name
- Forms stored in dedicated form column
- Example: species="Ogerpon", form="Wellspring"

### Changes Made

- Ogerpon forms: Updated 4 masks from separate species to forms
  - Base "Ogerpon" with form "Teal Mask"
  - Wellspring, Hearthflame, Cornerstone mask variants
  - Fixed all item variations to match form (e.g., "wellspringmask" → "Wellspring Mask")
- Urshifu forms: Updated to use form field
  - "Rapid Strike Urshifu" → species="Urshifu", form="Rapid Strike"
  - "Urshifu" → species="Urshifu", form="Single Strike"
  - Form identification based on signature moves (Surging Strikes → Rapid Strike, Wicked Blow → Single Strike)
- Regional Variants: Converted all to species + form format
  - Alolan: Dugtrio, Exeguttor, Golem, Muk, Ninetales, Persian, Raichu, Sandslash, Vulpix
  - Galarian: Articuno, Moltres, Zapdos, Slowbro, Slowking, Weezing
  - Hisuian: Arcanine, Avalugg, Braviary, Decidueye, Electrode, Goodra, Lilligant, Qwilfish, Samurott, Sliggoo, Sneasel, Typhlosion, Zoroark
  - Legendary forms: Kyurem (Black/White), Ursaluna (Bloodmoon), Necrozma (Dawn Wings/Dusk Mane), Landorus/Tornadus/Thundurus (Therian), Calyrex (Shadow Rider/Ice Rider), Deoxys (Speed)
  - Rotom forms: Frost, Heat, Wash, Mow
  - Therian forms: Enamorus, Landorus, Tornadus, Thundurus
  - Paradox Pokemon: Flutter Mane, Raging Bolt, Great Tusk, etc. (not split - names are just longer)

## Item Standardization

Problem: Case mismatches, typos, and missing values

### Changes Made

- Assault Vest: "assault vest", "Assalt Vest" → "Assault Vest"
- Booster Energy: "booster energy", "Boosterenergy", "BoosterEnergy" → "Booster Energy"
- Black Glasses: "black glass", "blackglasses" → "Black Glasses"
- Clear Amulet: "clear amulet", "Covert Cloak" (note: some were in ability column)
- Choice Specs: "choice specs", "choicespecs" → "Choice Specs"
- Choice Scarf: "choice scarf" → "Choice Scarf"
- Sitrus Berry: "citrus barry" → "Sitrus Berry"
- Covert Cloak: "Cover Cloat" → "Covert Cloak"
- Ogerpon Masks: Fixed all mask name variations
- Empty/None items: Standardized handling of empty values

## Ability Standardization

Problem: Items appearing in ability column, case/space issues

### Changes Made

- Water Absorb: " Water Absorb", " Water absorb", "WaterAbsorb" → "Water Absorb"
- Armor Tail: "Armor tail" → "Armor Tail"
- As One: "asone", "As One " → "As One"
- Beads of Ruin: "Beads Of Ruin", "beadsofruin" → "Beads of Ruin"
- Fixed ability values appearing in ability column (Assault Vest, Booster Energy, Clear Amulet, Covert Cloak, Choice Scarf, Choice Band)

## Move Standardization

Problem: Combined movesets stored as single strings, case issues

### Changes Made

- Combined movesets: Split "Wicked Blow - Sucker Punch - Close Combat - Detect" into separate move entries
- Extracted first move from combined format for proper move analysis
- Case standardization:
  - "Aerial ace" → "Aerial Ace"
  - "Aqua jet" → "Aqua Jet"
  - "Aqua tail" → "Aqua Tail"
  - "U-Turn" → "U-turn"
  - "Will-o-wisp" → "Will-O-Wisp"
- Removed leading/trailing spaces from move names

## Therian Form Assignment

Problem: Forms not properly assigned based on signature abilities

### Changes Made

- Tornadus:
  - Incarnate: Prankster or Defiant
  - Therian: Regenerator
- Thundurus:
  - Incarnate: Prankster or Defiant
  - Therian: Volt Absorb
- Landorus:
  - Incarnate: Sheer Force or Sand Force
  - Therian: Intimidate
- Enamorus:
  - Incarnate: Contrary or Healer
  - Therian: Overcoat
