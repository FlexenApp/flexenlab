# Dataset Cross-Check Report

Each row shows our dataset target vs the top-1 result from each source.
Tags: ✓ = within 15%, ≈ = within 30%, ✗ = >30% off, — = no data.

Sources note: FatSecret/USDA return per-serving values for the **first match**, which may not be the exact food the query describes (e.g. searching 'Big Mac' may return a different product). Claude web search searches authoritatively for the SPECIFIC query.

| # | Query | Field | Target | FatSecret | USDA | Claude(web) |
|---|---|---|---|---|---|---|
| 1 | 200g chicken breast, grilled | | | _Grilled Chicken Breast_ | _Chicken breast, grilled with s_ | — |
| | | kcal | **330** | 197 ✗ | 202 ✗ | — |
| | | protein | **62** | 30 ✗ | 21 ✗ | — |
| | | carbs | **0** | 0 ✓ | 7 ✗ | — |
| | | fat | **7.2** | 8 ✓ | 9 ≈ | — |
| 2 | tall starbucks caramel macchiato with whole milk | | | _Caramel Macchiato (Tall) (Star_ | _Starbucks Discoveries Caramel _ | — |
| | | kcal | **250** | 190 ≈ | 50 ✗ | — |
| | | protein | **10** | 8 ≈ | 1 ✗ | — |
| | | carbs | **33** | 26 ≈ | 8 ✗ | — |
| | | fat | **9** | 6 ✗ | 1 ✗ | — |
| 3 | grande iced brown sugar oat shaken espresso from starbucks | | | _Iced Brown Sugar Oatmilk Shake_ | _Sugar, brown_ | — |
| | | kcal | **120** | 150 ≈ | 380 ✗ | — |
| | | protein | **1** | 2 ≈ | 0 ≈ | — |
| | | carbs | **25** | 27 ✓ | 98 ✗ | — |
| | | fat | **2.5** | 5 ✗ | 0 ✗ | — |
| 4 | Big Mac with medium fries and a Coke | | | _Diet Coke with Lime (Coca-Cola_ | _McDONALD'S, BIG MAC (without B_ | — |
| | | kcal | **1080** | 0 ✗ | 234 ✗ | — |
| | | protein | **31** | 0 ✗ | 13 ✗ | — |
| | | carbs | **142** | 0 ✗ | 21 ✗ | — |
| | | fat | **44** | 0 ✗ | 12 ✗ | — |
| 5 | two scoops of Ben & Jerry's Cherry Garcia | | | _Cherry Garcia Ice Cream (Ben &_ | _BEN & JERRY'S, ICE CREAM, CHER_ | — |
| | | kcal | **480** | 340 ≈ | 217 ✗ | — |
| | | protein | **8** | 5 ✗ | 3 ✗ | — |
| | | carbs | **56** | 38 ✗ | 22 ✗ | — |
| | | fat | **26** | 20 ≈ | 13 ✗ | — |
| 6 | double-double animal style with fries from in n out | | | _Double-Double with Onion (In-N_ | _Double cheeseburger, from fast_ | — |
| | | kcal | **1185** | 610 ✗ | 299 ✗ | — |
| | | protein | **47** | 34 ≈ | 20 ✗ | — |
| | | carbs | **96** | 42 ✗ | 10 ✗ | — |
| | | fat | **65** | 34 ✗ | 19 ✗ | — |
| 7 | slice of pepperoni pizza at Sam's Club | | | _Pepperoni Pizza (Sam's Club)_ | _Pizza with pepperoni, stuffed _ | — |
| | | kcal | **700** | 380 ✗ | 296 ✗ | — |
| | | protein | **32** | 18 ✗ | 13 ✗ | — |
| | | carbs | **70** | 34 ✗ | 27 ✗ | — |
| | | fat | **32** | 20 ✗ | 15 ✗ | — |
| 8 | Chipotle chicken burrito bowl with brown rice black beans corn salsa cheese and guac | | | _Burrito Bowl (Chipotle Mexican_ | _Burrito bowl, chicken, with be_ | — |
| | | kcal | **905** | 910 ✓ | 145 ✗ | — |
| | | protein | **53** | 58 ✓ | 13 ✗ | — |
| | | carbs | **95** | 79 ≈ | 11 ✗ | — |
| | | fat | **36** | 39 ✓ | 5 ✗ | — |
| 9 | Sweetgreen Harvest Bowl | | | _Harvest Bowl (Sweetgreen)_ | _Burrito bowl, chicken_ | — |
| | | kcal | **685** | 760 ✓ | 161 ✗ | — |
| | | protein | **30** | 40 ✗ | 21 ≈ | — |
| | | carbs | **84** | 60 ≈ | 0 ✗ | — |
| | | fat | **25** | 42 ✗ | 8 ✗ | — |
| 10 | Beyond Burger patty pan-fried with cheese | | | _Meatless Vegetable Burger or P_ | _Pork sausage, link/patty, cook_ | — |
| | | kcal | **420** | 179 ✗ | 325 ≈ | — |
| | | protein | **25** | 18 ≈ | 19 ≈ | — |
| | | carbs | **10** | 13 ✗ | 1 ✗ | — |
| | | fat | **32** | 6 ✗ | 27 ≈ | — |
| 11 | Trader Joe's Mandarin Orange Chicken half bag | | | _Mandarin Orange Chicken (Trade_ | _TRADER JOE'S, HALF & HALF_ | — |
| | | kcal | **410** | 320 ≈ | 133 ✗ | — |
| | | protein | **19** | 21 ✓ | 3 ✗ | — |
| | | carbs | **56** | 24 ✗ | 7 ✗ | — |
| | | fat | **13** | 16 ≈ | 10 ≈ | — |
| 12 | two large eggs scrambled with butter | | | _Scrambled Egg made from Dry Eg_ | _Egg omelet or scrambled egg, m_ | — |
| | | kcal | **230** | 238 ✓ | 182 ≈ | — |
| | | protein | **13** | 10 ≈ | 12 ✓ | — |
| | | carbs | **1** | 1 ✓ | 1 ✓ | — |
| | | fat | **19** | 21 ✓ | 15 ≈ | — |
| 13 | half a chipotle chicken burrito | | | _Burrito Bowl (Chipotle Mexican_ | _Burrito bowl, chicken_ | — |
| | | kcal | **580** | 910 ✗ | 161 ✗ | — |
| | | protein | **26** | 58 ✗ | 21 ≈ | — |
| | | carbs | **65** | 79 ≈ | 0 ✗ | — |
| | | fat | **21** | 39 ✗ | 8 ✗ | — |
| 14 | three slices of cheese pizza | | | _Three Cheese XLNY Pizza - Fami_ | _THREE CHEESE PIZZA, THREE CHEE_ | — |
| | | kcal | **855** | 180 ✗ | 232 ✗ | — |
| | | protein | **36** | 9 ✗ | 8 ✗ | — |
| | | carbs | **108** | 21 ✗ | 26 ✗ | — |
| | | fat | **30** | 8 ✗ | 10 ✗ | — |
| 15 | a handful of almonds | | | _Just a Handful of Raw Almonds _ | _APPLEBEE'S, fish, hand battere_ | — |
| | | kcal | **165** | 200 ≈ | 202 ≈ | — |
| | | protein | **6** | 7 ≈ | 13 ✗ | — |
| | | carbs | **6** | 8 ✗ | 17 ✗ | — |
| | | fat | **14** | 17 ≈ | 9 ✗ | — |
| 16 | small bowl of oatmeal with banana and honey | | | _Banana Oatmeal Pancakes_ | _Babyfood, cereal, oatmeal, wit_ | — |
| | | kcal | **290** | 1828 ✗ | 399 ✗ | — |
| | | protein | **6** | 59 ✗ | 7 ✓ | — |
| | | carbs | **60** | 202 ✗ | 78 ✗ | — |
| | | fat | **4** | 91 ✗ | 7 ✗ | — |
| 17 | Thai green curry takeout, about half the box | | | _Green Curry Paste_ | _SMART SOUP, Thai Coconut Curry_ | — |
| | | kcal | **420** | 69 ✗ | 36 ✗ | — |
| | | protein | **18** | 3 ✗ | 1 ✗ | — |
| | | carbs | **45** | 13 ✗ | 7 ✗ | — |
| | | fat | **25** | 1 ✗ | 1 ✗ | — |
| 18 | ramen tonkotsu with chashu and ajitama | | | _Tonkotsu Ramen (Nong Shim)_ | _SPICY TONKOTSU RAMEN, SPICY TO_ | — |
| | | kcal | **850** | 450 ✗ | 397 ✗ | — |
| | | protein | **38** | 8 ✗ | 6 ✗ | — |
| | | carbs | **85** | 64 ≈ | 51 ✗ | — |
| | | fat | **38** | 18 ✗ | 18 ✗ | — |
| 19 | Pho Bo large with extra brisket | | | _Oriental Style Beef and Rice N_ | _Soup, pho, with meat_ | — |
| | | kcal | **720** | 3928 ✗ | 77 ✗ | — |
| | | protein | **48** | 388 ✗ | 6 ✗ | — |
| | | carbs | **100** | 376 ✗ | 6 ✗ | — |
| | | fat | **12** | 86 ✗ | 3 ✗ | — |
| 20 | elote cup | | | _Dessert Topping (Powdered with_ | _ELOTE SEASONING, ELOTE_ | — |
| | | kcal | **380** | 189 ✗ | 0 ✗ | — |
| | | protein | **11** | 4 ✗ | 0 ✗ | — |
| | | carbs | **38** | 17 ✗ | 67 ✗ | — |
| | | fat | **20** | 12 ✗ | 0 ✗ | — |
| 21 | carne apache | | | _Chili Con Carne_ | _Acorn stew (Apache)_ | — |
| | | kcal | **250** | 1692 ✗ | 95 ✗ | — |
| | | protein | **22** | 131 ✗ | 7 ✗ | — |
| | | carbs | **6** | 141 ✗ | 9 ✗ | — |
| | | fat | **14** | 69 ✗ | 3 ✗ | — |
| 22 | Mac and Cheese with Spam and Kimchi | | | _Cauliflower Mac and Cheese_ | _Spam_ | — |
| | | kcal | **720** | 2210 ✗ | 315 ✗ | — |
| | | protein | **28** | 84 ✗ | 13 ✗ | — |
| | | carbs | **78** | 61 ≈ | 5 ✗ | — |
| | | fat | **32** | 189 ✗ | 27 ≈ | — |
| 23 | 1 cup of cooked white rice | | | _White Rice (Unsalted)_ | _Rice, white, cooked, glutinous_ | — |
| | | kcal | **205** | 205 ✓ | 96 ✗ | — |
| | | protein | **4.3** | 4 ✓ | 2 ✗ | — |
| | | carbs | **45** | 45 ✓ | 21 ✗ | — |
| | | fat | **0.4** | 0 ✓ | 0 ✓ | — |
| 24 | medium banana | | | _Bananas_ | _Bananas, dehydrated, or banana_ | — |
| | | kcal | **105** | 89 ≈ | 346 ✗ | — |
| | | protein | **1.3** | 1 ✓ | 4 ✗ | — |
| | | carbs | **27** | 23 ≈ | 88 ✗ | — |
| | | fat | **0.4** | 0 ✓ | 2 ≈ | — |
| 25 | salmon fillet baked | | | _Baked or Broiled Salmon_ | _Fish, salmon, baked or broiled_ | — |
| | | kcal | **350** | 1445 ✗ | 274 ≈ | — |
| | | protein | **39** | 203 ✗ | 25 ✗ | — |
| | | carbs | **0** | 4 ✗ | 0 ✓ | — |
| | | fat | **21** | 64 ✗ | 18 ✓ | — |

## Summary

- Cases where ≥2 sources AGREE with our target on kcal: **0**
- Cases where ≥2 sources DISAGREE with our target on kcal: **21**
- Total cases: 25
