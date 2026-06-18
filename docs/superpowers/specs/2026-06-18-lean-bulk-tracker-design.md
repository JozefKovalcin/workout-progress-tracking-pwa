# Lean Bulk Tracker – návrh aplikácie

## 1. Cieľ a forma

Vytvoriť osobnú, mobile-first PWA aplikáciu použiteľnú na mobile vo fitku aj na PC doma. Aplikácia nahradí pôvodný Excel, zachová jeho tréningový plán a cviky, ale zjednoduší denné zapisovanie a pridá vysvetliteľné odporúčania.

- Google prihlásenie cez Firebase Authentication.
- Firestore pre synchronizáciu medzi zariadeniami.
- Offline zápis s lokálnou cache; po obnovení spojenia automatická synchronizácia.
- Stav uloženia: „uložené v zariadení“ alebo „synchronizované“.
- Konflikt rovnakého záznamu rieši najnovšia úprava.
- Export všetkých dát do CSV a JSON.
- Automatická svetlá/tmavá téma podľa systému.
- Bez notifikácií.

## 2. Denný zápis a dashboard

Dashboard začína výraznou kartou **Dnes – dátum**. Dnešný deň sa určí podľa rozvrhu, ale používateľ ho môže jedným klikom prepnúť medzi tréningom a voľnom.

Denné vstupy:

- ranná váha v kg,
- ranný pás v cm,
- celkové prijaté kcal,
- kvalita spánku 1–10,
- chuť/pripravenosť trénovať 1–10,
- v tréningový deň kvalita tréningu/pumpy 1–10.

Subjektívne hodnotenia sú podporný kontext. Samostatne nikdy nespustia zmenu kalórií.

Dashboard zobrazuje:

- cieľ kcal a odporúčané P/C/F pre dnešný typ dňa,
- stav kalibračnej fázy, napríklad „deň 6 z 14“,
- 7-dňový priemer a trend váhy,
- trend pásu,
- adherenciu ku kalóriám,
- aktuálnu radu s vysvetlením,
- históriu posledných dní a možnosť spätnej opravy,
- návrhy zmien cieľov s akciami **Prijať** a **Zamietnuť**,
- 7-dňový merač výkonu hlavných cvikov.

Merač výkonu porovná posledný top set každého hlavného cviku s jeho predchádzajúcim porovnateľným top setom pomocou odhadu e1RM z váhy a opakovaní. RIR sa zobrazí ako kontext a pri výrazne odlišnom RIR sa porovnanie označí ako menej spoľahlivé. Dashboard ukáže:

- celkovú percentuálnu zmenu za posledných 7 dní,
- zelenú/červenú trendovú šípku,
- percentuálnu zmenu každého porovnateľného cviku,
- nové osobné rekordy,
- upozornenie na opakovaný pokles výkonu.

Cvik bez dvoch porovnateľných záznamov sa do celkového skóre nezapočíta. Celkové skóre je priemer percentuálnych zmien zahrnutých cvikov, pričom každý cvik má rovnakú váhu.

Navigácia na mobile: **Dnes, Progress, Tréning, História, Nastavenia**. Na PC sa zobrazí ako bočný panel.

## 3. Tréning

Platí päťdňový rozvrh z Excelu:

- pondelok,
- streda,
- piatok,
- sobota,
- nedeľa.

Rozvrh, tréningové dni, cviky aj ich poradie sú upraviteľné. Cvik možno pridať, upraviť, odstrániť, dočasne nahradiť alebo označiť ako hlavný bez straty starej histórie.

Pri hlavnom cviku sa zapisuje iba najlepší pracovný set:

- váha,
- opakovania,
- RIR,
- voliteľná poznámka.

Pred zápisom aplikácia ukáže posledný top set, rozsah opakovaní, e1RM a poslednú percentuálnu zmenu.

Predvolený katalóg sa prevezme z hárku **Cviky**. Ako hlavné sa označia:

- Incline DB press
- Machine chest press
- Flat Bench Press
- Chest-supported row
- Lat pulldown
- Chin row
- Cable lateral raise
- Hack squat / leg press
- Seated/lying leg curl
- RDL
- Hip thrust
- Walking lunge
- Standing calf raise
- Cable crunch
- Dragon Flag

Chybne skonvertovaný rozsah pri Flat Bench Press sa normalizuje na 6–10 opakovaní. Všetky rozsahy zostanú upraviteľné.

## 4. Kalibračná a stabilizačná fáza

Začiatok: **19. júna 2026**. Počiatočná hmotnosť: **81,4 kg**. Prvých 14 dní sa označí ako **kalibračná fáza / stabilizačný blok**, nie ako presné meranie maintenance.

Počas prvých 14 dní:

| Typ dňa | kcal | Bielkoviny | Tuky | Sacharidy |
|---|---:|---:|---:|---:|
| Tréning | 2 900 | 180 g | 50 g | 432 g, v UI prakticky 430–435 g |
| Voľno | 2 700 | 180 g | 50 g | 382 g, v UI prakticky 380–385 g |

- Počas tejto fázy sa ciele automaticky nemenia.
- Aplikácia priebežne počíta trendy, ale návrh zmeny ukáže najskôr po 14 dňoch použiteľných dát.
- Použiteľný deň pre hmotnostný trend obsahuje váhu; pre kalorickú adherenciu obsahuje prijaté kcal.
- Pás sa zapisuje denne podľa preferencie používateľa.

## 5. Rozhodovací systém

Po 14 dňoch aplikácia porovná:

- 7-dňový priemer váhy prvého týždňa,
- 7-dňový priemer váhy druhého týždňa,
- percentuálnu zmenu hmotnosti za týždeň,
- trend pásu,
- výkon hlavných cvikov,
- adherenciu ku kalóriám,
- podporné subjektívne hodnotenia.

Minimálna kvalita dát pre vytvorenie návrhu:

- aspoň 5 záznamov váhy v každom porovnávanom 7-dňovom týždni,
- aspoň 10 dní so zapísanými kcal z posledných 14 dní,
- aspoň 4 merania pásu z posledných 14 dní,
- aspoň jeden porovnateľný hlavný cvik, ak má výkon ovplyvniť rozhodnutie.

Kalorická adherencia je dostatočná, keď je priemerná absolútna odchýlka od denného cieľa najviac 10 %. Stabilná váha znamená týždennú zmenu medzi −0,2 % a +0,2 %. Rast pásu znamená zvýšenie priemeru druhého týždňa aspoň o 0,5 cm oproti prvému týždňu. Tieto prahy budú viditeľné v nastaveniach, ale v prvej verzii nebudú používateľsky meniteľné.

Pravidlá:

| Situácia | Návrh |
|---|---|
| Váha a pás sú stabilné, výkon je v poriadku | +100 kcal iba v tréningové dni |
| Váha rastie nad približne 0,5 % týždenne a zároveň rastie pás | −150 až −200 kcal; predvolene znížiť sacharidy |
| Váha klesá viac než približne 0,5 % týždenne alebo 0,5 kg týždenne a výkon slabne | +100 až +150 kcal zo sacharidov |
| Dáta sú neúplné, protichodné alebo adherencia nedostatočná | Ciele nemení a uvedie chýbajúce alebo problematické dáta |

Rast pásu sa hodnotí z vyhladeného 7-dňového priemeru, nie z jedného dňa. Výkon sa považuje za slabnúci, ak je 7-dňové skóre negatívne alebo rovnaký hlavný cvik klesne v dvoch po sebe idúcich porovnaniach. Subjektívny stav môže znížiť alebo zvýšiť mieru istoty, ale nemôže sám vytvoriť návrh.

Po kalibrácii je cieľový rast **0,2–0,35 % hmotnosti týždenne**. Pri 81,4 kg je to približne **0,16–0,28 kg/týždeň**. Ďalšie hodnotenie prebehne vždy po 14 dňoch od prijatia alebo zamietnutia návrhu, nie po jednotlivom výkyve.

Každý návrh obsahuje:

- zhrnutie dôvodu,
- použité trendy a počet platných dní,
- pôvodné a navrhované kcal a P/C/F,
- mieru istoty,
- tlačidlá **Prijať** a **Zamietnuť**.

Po prijatí začne zmena nasledujúci deň a uloží sa do histórie cieľov. Bielkoviny a tuky zostávajú stabilné; kalorické zmeny sa vykonávajú prednostne cez sacharidy. Tracker nikdy neupraví ciele bez potvrdenia používateľa.

## 6. Dáta a bezpečnosť

Údaje sú uložené pod Firebase UID používateľa. Firestore pravidlá dovolia čítať a zapisovať iba vlastné dokumenty.

Hlavné dátové celky:

- profil a aktuálna fáza,
- denné záznamy,
- tréningový plán a katalóg cvikov,
- top sety,
- história cieľov,
- návrhy a rozhodnutia.

Odvodené trendy sa počítajú z uložených zdrojových dát, aby sa po spätnej oprave automaticky obnovili. Odporúčania sú vysvetliteľný pravidlový systém, nie medicínske rozhodnutia ani generatívna AI.

## 7. Akceptačné kritériá

- Rovnaké dáta sú po prihlásení dostupné na mobile aj PC.
- Denný záznam možno vytvoriť offline a po návrate online sa synchronizuje.
- Dnešný deň je na dashboarde jasne zvýraznený a zapisovateľný bez hľadania v tabuľke.
- Starší záznam možno opraviť a všetky trendy sa prepočítajú.
- Počas prvých 14 dní sa nevytvorí vykonateľný návrh zmeny cieľov.
- Po 14 dňoch systém správne rozlíši štyri rozhodovacie situácie a nikdy nezmení cieľ bez potvrdenia.
- Merač cvikov nezapočíta cvik bez porovnateľných záznamov a transparentne ukáže použité cviky.
- Tréningový plán a cviky možno upraviť bez straty histórie.
- Rozhranie je použiteľné v svetlej aj tmavej téme a na úzkom mobilnom displeji.
