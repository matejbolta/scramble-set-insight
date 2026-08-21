# Full-floating tracing kot cycle-residue DP — working design

## Namen dokumenta

To je kuriran tehnični handoff iz daljšega prostega pogovora. Cilj je ohraniti
vse domain ugotovitve, odstraniti ponavljanje in jasno ločiti:

- matematično potrjena pravila;
- IRL algcounte, ki jih je človek dopisal kot potrjeno domain truth;
- implementacijske posledice teh pravil;
- dejansko odprta vprašanja, predvsem reduction graph in omejitve buffer seta.

Dokument je bil prvotno zasnovan za **full floating**. Exact partial
pseudoswap razširitev je zdaj implementirana z označenimi `B/N` cycle-classi;
kuriran opis te razširitve je v `logic_book.md`. Exact singleton `UFR / UF`
cutover in namerna izjema za legacy singleton weakswap edge tracing sta prav
tako dokumentirana tam.

Unit-weight residue katalog ostaja osnovni domain model. Weighted razširitev
ohranja vse Pareto poti `(commi, orientation algi)` za weight `>= 1`.

**Status:** exact full-floating in partial-pseudoswap algcount za weight `1` in
custom orientation weighte `>= 1` je implementiran v `web/cycle-residue.js` in
`web/cycle-residue-planner.js`. Residue katalog, concrete oracle, exhaustive
weighted class oracle in selected-buffer class oracle so aktivni regresijski
testi. Rekonstrukcija dejanskega optimized mema ter ločen review weakswapa
ostajata nadaljnja koraka.

---

## 1. Zakaj sedanji DLin DFS ni pravi končni model

Sedanji JavaScript DLin planer naredi pravilno bogat, vendar drag search:

1. scramble pretvori v 24-sticker state;
2. state razbije na disjoint fizične piece-cycle;
3. preiskuje vrstne rede cyclov;
4. za vsak cycle preiskuje dovoljene notranje in zunanje bufferje;
5. preiskuje entry stickerje;
6. v DP ključu še vedno nosi celoten virtualni sticker-state.

Posledica je približno 1.400 obiskanih stanj na povprečen scramble, občasno več
kot 60.000, in približno 17 sekund za full-floating 10k run.

Za algcount večine te informacije po začetni cycle-dekompoziciji ne
potrebujemo. Posamezen cycle lahko reduciramo na:

- že dokončno določeno število navadnih commov;
- majhen parity/orientation residue tip.

Nato iščemo po majhnem graphu legalnih redukcij teh residuov. Katalog IRL
zaprtih skupin pove, kateri sistemi so rešljivi in kakšen je njihov skupni
algcount brez LTCT; ne pomeni pa, da ima vsaka skupina samo eno izvedbeno pot.

### Kritična napaka sedanjega generičnega odd-segment pairinga

Sedanja formula približno pravi:

```text
sum(standalone segment costov) - floor(number_of_odd_segments / 2)
```

To ni splošno pravilno.

Kontraprimer sta dva pravilno orientirana corner 2-swapa:

```text
A B A
C D C
```

Skupaj ju lahko traceamo kot:

```text
A: B C D A
```

To so štirje targeti oziroma **2 alga**, ne 1. Sedanji generični
`saved_by_linking = 1` bi tak sintetični primer podcenil.

Zato nova optimizacija ne sme samo pospešiti iste formule. Zamenjati mora tudi
cost model: najprej base commi posameznih cyclov, nato typed residue reduction
graph z IRL-validiranimi total costi in vsemi LTCT-relevantnimi izhodi.

---

## 2. Osnovni podpis fizičnega cycla

Za fizični cycle z `k` kosi hranimo dva invarianta.

### 2.1 Permutation oziroma parity komponenta

```text
p = (k - 1) mod 2
```

- `k` lih  → `p = 0` oziroma parity-closed;
- `k` sod  → `p = 1` oziroma parity-open.

### 2.2 Orientation charge

Za edge:

```text
f ∈ Z₂ = {0, 1}
```

Za corner:

```text
t ∈ Z₃ = {0, +1, -1}
```

Cycle ali skupina cyclov je povsem zaprta natanko tedaj, ko sta skupna
permutation in orientation charge oba nič.

### 2.3 Pomemben pomen »correctly oriented cycle«

`orientation charge = 0` ne pomeni nujno, da je vsak kos v cyclu pravilno
orientiran. Pomeni samo, da je **net charge** nič.

Primeri:

- dva flipa v istem edge cyclu imata net edge charge `0`;
- corner orientacije `+1, +1, +1` imajo net charge `0 mod 3`;
- corner orientaciji `+1, -1` imata net charge `0`.

To je dovolj za signature algebra, vendar mora konkretna trace konstrukcija še
vedno dokazati, da base commi res absorbirajo notranjo orientacijo tako, kot
predvideva redukcija.

### 2.4 `k = 1` ni poseben fundamentalni razred

`k = 1` naravno pade v isti model:

- orientation `0` → solved kos;
- edge charge `1` → flip in place;
- corner charge `+1/-1` → twist in place.

---

## 3. Redukcija posameznega cycla

Spodnje formule štejejo base comme, kadar ima cycle legalen notranji buffer.

### Lih `k`

```text
base = (k - 1) / 2
```

- charge `0`: cycle je v celoti rešen in izgine;
- nen ničeln charge: po base commih ostane `F`, `T+` ali `T-` residue.

### Sod `k`

```text
base = (k - 2) / 2
```

Po base commih ostane typed 2-swap residue `P`, `PF`, `P0`, `P+` ali `P-`.

S tem se vsak poljubno dolg cycle reducira na največ en majhen residue.

### Povezava s sandwichingom

Za cycle z `k` kosi:

- notranji buffer proizvede `k - 1` targetov;
- zunanji in-place buffer proizvede `k + 1` targetov.

Primer lihega 3-cycla:

```text
B → I → Z → B

notranji B:  I Z       (1 alg)
zunanji Q:   B I Z B   (2 alga)
```

Primer sodega 4-cycla:

```text
B → C → T → U → B

notranji B:  C T U       (base + P residue)
zunanji Q:   B C T U B   (en alg dražji vstop/izstop)
```

Sandwich zato ni poseben string hack, ampak razlika med notranjo in zunanjo
realizacijo istega fizičnega cycla.

### Twisted/flipped-in-place zunanji buffer

Za zunanji buffer mora biti pravi fizični kos v svojem domačem slotu, ni pa
nujno pravilno orientiran. Zato sta legalni obe možnosti:

- orientation residue pustimo za poznejši 2-flip/2-twist atom;
- kos uporabimo kot zunanji buffer za drug cycle, s čimer se lahko spremeni
  porazdelitev residuov in končni cost.

Ta možnost je eden od razlogov, da fast DP morda potrebuje majhno action tabelo
poleg samega net podpisa. Nova redukcija je ne sme po nesreči izgubiti.

---

## 4. Fundamentalni residue tipi

### 4.1 Edges: 4 razredi skupaj s closed razredom

| Tip | Podpis `(p,f)` | Pomen |
|---|---:|---|
| `C` | `(0,0)` | povsem closed; takoj prištej base in odstrani |
| `F` | `(0,1)` | parity-closed, flip-open |
| `P` | `(1,0)` | orientation-correct parity-open 2-swap residue |
| `PF` | `(1,1)` | parity-open in flip-open |

Po odstranitvi `C` ostanejo samo `F`, `P`, `PF`.

Seštevanje parov:

| Prvi | Drugi | Skupni residue |
|---|---|---|
| `F` | `F` | closed |
| `F` | `P` | `PF` |
| `F` | `PF` | `P` |
| `P` | `P` | closed |
| `P` | `PF` | `F` |
| `PF` | `PF` | closed |

### 4.2 Corners: 6 razredov skupaj s closed razredom

| Tip | Podpis `(p,t)` | Pomen |
|---|---:|---|
| `C` | `(0,0)` | povsem closed |
| `T+` | `(0,+1)` | parity-closed, positive twist residue |
| `T-` | `(0,-1)` | parity-closed, negative twist residue |
| `P0` | `(1,0)` | orientation-correct parity-open 2-swap |
| `P+` | `(1,+1)` | parity-open z `+` twist chargeom |
| `P-` | `(1,-1)` | parity-open z `-` twist chargeom |

Po odstranitvi `C` ostanejo `T+`, `T-`, `P0`, `P+`, `P-`.

Primer, ki je bil posebej potrjen:

- `P0 + P0` je closed dvojni cycle;
- `P0 + P+` ni closed: parity se izniči, ostane `T+`.

---

## 5. Popoln katalog minimalnih closed atomov

»Minimalen atom« pomeni zaprto multiset skupino residuov, ki ne vsebuje
manjšega nepraznega closed podsklopa. **Atom tukaj ni nedeljiva izvedbena
operacija.** Isti atom lahko rešujemo v različnih vrstnih redih in ga po enem
ali več algih reduciramo v različne manjše zaprte oblike.

Katalog je bil dodatno izčrpno preverjen z algebraičnim enumeriranjem. Pri
cornerjih je upoštevano:

- največ 8 fizičnih cornerjev;
- `T` residue potrebuje najmanj 1 kos;
- `P` residue potrebuje najmanj 2 kosa.

Rezultat je res natanko 3 para, 6 trojčkov in 6 četvorčkov. Večji minimalni
corner atomi na fizični 3×3 kocki niso možni.

### 5.1 Edge closed atomi

Closed pari:

```text
F  F
P  P
PF PF
```

Edini minimalni closed trojček:

```text
F P PF
```

To je celoten edge katalog. Minimalnih edge četvorčkov ne potrebujemo; vsak
closed večji multiset se razstavi na zgornje atome.

### 5.2 Corner closed pari — 3

```text
T+ T-
P0 P0
P+ P-
```

### 5.3 Corner closed trojčki — 6

Tri inverse-simetrične dvojice:

```text
T+ T+ T+
T- T- T-

T+ P+ P+
T- P- P-

T+ P0 P-
T- P0 P+
```

### 5.4 Corner closed četvorčki — 6

Tri inverse-simetrične dvojice:

```text
P0 P+ P+ P+
P0 P- P- P-

T+ T+ P- P-
T- T- P+ P+

T+ T+ P0 P+
T- T- P0 P-
```

Noben od teh četvorčkov ne vsebuje closed singla, para ali trojčka.

---

## 6. Corner parity terminali

Corners niso vedno sami povsem closed. Lahko imajo skupni podpis `P0`; zadnji
corner 2-swap se zapre skupaj z edge parityjem. Toda parity algset ni poljuben
`P0`: vsak njegov alg hkrati naredi natanko `UF / UR` edge 2-swap in
`UFR / XYZ` corner 2-swap. Zato mora biti UFR fizično eden od dveh kosov v
zadnjem `P0`. To ni isto kot closed atom `P0 + P0`.

Po odstranitvi vseh closed podsklopov obstaja natanko 7 minimalnih parity
terminalov:

```text
P0

T+ P-
T- P+

T+ T+ P+
T- T- P-

P+ P+ P+
P- P- P-
```

Edges parity terminala nimajo, če pred redukcijo pravilno zgradimo
parity-relative `UF / UR` goal. Njihov skupni relative podpis mora biti closed.

Parity execution spada v corner count.

---

## 7. Potrjeni IRL total costi in večpotne redukcije

Vsi spodnji costi so **dodatni residue costi brez LTCT**. Base commi
posameznih fizičnih cyclov so že prišteti po 3. poglavju. Vrednosti je človek
dodal v izvorni seznam in so potrjena domain truth.

### 7.1 Osrednje pravilo redukcije

Vsaka reduction pot skozi **kateri koli zaprt atom** je zaporedje algov. Vsak
alg pred zadnjim reši enega ali dva konkretna kosa ter preostanek pretvori v
drug, manjši zaprt primer. Kateri manjši primer dobimo, je odvisno od tega, kaj
rešimo najprej.

Zaključni alg atoma reši celoten preostanek. Če je to klasični 3-cycle alg,
reši zadnje tri v njem udeležene kose; če je 2-flip ali 2-twist, reši zadnja
dva.

Zato potrjeni total cost atoma **ni njegova edina transition pot**:

- pri edges izbira poti za poznejšo optimizacijo ni pomembna;
- pri corners je pomembna, ker lahko različne poti končajo npr. v 2-twistu ali
  v zaprtem 3-cyclu;
- ti dve končni obliki imata lahko enak navaden algcount, vendar nista
  ekvivalentni za poznejše lovljenje LTCT/T2C primary vloge.

Corner atoma zato ne smemo prezgodaj zamenjati z enim scalar costom. Search
mora do finish odločitve ohraniti vse relevantne reduction endpointe.

### 7.2 Edge closed atomi

| Atom | Potrjen dodatni cost |
|---|---:|
| `F F` | en 2-flip, torej `1` |
| `P P` | `2` alga |
| `PF PF` | `2` alga |
| `F P PF` | `3` algi |

To so vsi edge atomi. Edge parity terminala ni. Različni legalni vrstni redi
edge redukcij ne ustvarijo poznejše LTCT razlike, zato jih lahko edge DP za
algcount kanonizira.

### 7.3 Corner closed pari

| Atom | Potrjen dodatni cost |
|---|---:|
| `T+ T-` | en 2-twist, torej `1` |
| `P0 P0` | `2` alga |
| `P+ P-` | `2` alga |

Posebej pomembno: dva 2-swapa ne postaneta en alg samo zato, ker tvorita
closed par. `A:BCDA` je 2-alg konstrukcija.

### 7.4 Corner closed trojčki — vseh 6 eksplicitno

| Atom | Potrjen total pri unit weightu | Znane relevantne redukcije |
|---|---:|---|
| `T+ T+ T+` | `2` | med drugim 1-alg redukcija do `T+ T-` |
| `T- T- T-` | `2` | zrcalna 1-alg redukcija do 2-twista |
| `T+ P+ P+` | `3` | reducira se lahko v `T+ T-` **ali** v zaprt 3-cycle |
| `T- P- P-` | `3` | zrcalno: 2-twist **ali** zaprt 3-cycle |
| `T+ P0 P-` | `3` | reducira se lahko v `T+ T-` **ali** v zaprt 3-cycle |
| `T- P0 P+` | `3` | zrcalno: 2-twist **ali** zaprt 3-cycle |

Pri zadnjih štirih trojčkih lahko z dvema algoma pridemo bodisi do 2-twista
bodisi do zaprtega 3-cycla; zadnji korak je nato 2-twist oziroma navaden comm.
Obe poti mora finish-aware planer ohraniti, dokler ni znan globalni kontekst.

### 7.5 Corner closed četvorčki — vseh 6 eksplicitno

| Atom | Potrjen total pri unit weightu | Reduction opomba |
|---|---:|---|
| `P0 P+ P+ P+` | `5` | po 2 algih lahko preide v različne spodaj eksplicitno naštete trojčke |
| `P0 P- P- P-` | `5` | zrcalno enaka množica reduction možnosti |
| `T+ T+ P- P-` | `4` | več legalnih reduction vrstnih redov; ne kanoniziraj prezgodaj |
| `T- T- P+ P+` | `4` | zrcalne reduction poti |
| `T+ T+ P0 P+` | `4` | več legalnih reduction vrstnih redov; ne kanoniziraj prezgodaj |
| `T- T- P0 P-` | `4` | zrcalne reduction poti |

»Eden od spodnjih štirih trojčkov« iz izvornega pogovora pomeni natanko te
štiri eksplicitne tipe:

```text
T+ P+ P+
T- P- P-
T+ P0 P-
T- P0 P+
```

Ista večpotnost velja za oba `P0 P± P± P±` četvorčka. Prav zato pri preostalih
štirih četvorčkih v izvornem pogovoru ni bila dopisana ena sama reduction pot:
njihov potrjeni total je `4`, vendar ga lahko dosežemo prek različnih manjših
zaprtih primerov, odvisno od prvih rešenih kosov.

### 7.6 Corner parity terminali — vseh 7 eksplicitno

| Terminal | Potrjen cost brez LTCT |
|---|---:|
| `P0` | parity alg, če je UFR v `P0`; sicer je potreben link do takega finisha |
| `T- P+` | `1` alg + parity alg |
| `T+ P-` | `1` alg + parity alg |
| `T- T- P-` | `2` alga + parity alg |
| `T+ T+ P+` | `2` alga + parity alg |
| `P- P- P-` | `3` algi + parity alg |
| `P+ P+ P+` | `3` algi + parity alg |

### 7.7 LTCT in T2C sta globalna izbira reduction poti

Zgornji total costi so potrjeni brez LTCT/T2C. Njuni minimumi ne nastanejo tako,
da vsak atom najprej neodvisno zapremo po eni kanonični poti in na koncu
odštejemo `1`.

Tabela opisuje typed spodnje meje. Tudi pri navadnem parity finishu mora planer
ohraniti fizično identiteto kosov: anonimni `P0` ni avtomatsko parity alg. Exact
finish search spodaj uveljavi, da zadnji `P0` vsebuje UFR.

Planer mora primerjati reduction poti, ker lahko ena pot pusti 2-twist obliko,
druga pa zaprt 3-cycle oziroma drugačen parity/twist endpoint. Šele ko je znan
celoten preostanek, lahko izbere pot, ki omogoči najboljši finish algset.

Capability je hierarhičen:

```text
none < ltct < t2c
```

Kdor zna T2C, avtomatsko zna tudi LTCT. Pri parity terminalu `P+ T-` oziroma
`P- T+` je navadni cost `2`:

- z `ltct` je cost `1`, kadar je fizični UFR kos eden od dveh kosov v `P`;
- z `t2c` je cost `1` tudi, kadar je UFR sam `T` residue, torej twisted in
  place;
- če UFR ni eden od treh kosov tega terminala, ostane cost `2`.

Minimalni primary-role metadata je zato:

```text
in-P | is-T | uninvolved
```

Pri capability `t2c` je terminal poceni za prvi dve vlogi; pri `ltct` samo za
`in-P`.

Konkretnih reduction tabel človeku ni treba ročno naštevati: iz tracinga je
vsaka poteza jasna in implementacija jih lahko sistematično izpelje. Pomembna
domain zahteva je, da jih search **enumerira**, namesto da bi iz zgornjih
totalov naredil eno samo transition pravilo na atom.

---

## 8. Predlagani hitri algoritem

### Korak 1: exact cycle decomposition

Iz sticker-statea dobimo disjoint fizične cycle z:

- `k`;
- permutation parity komponento;
- edge flip oziroma corner twist chargeom;
- konkretnimi cycle sticker orbiti;
- identiteto cyclov za poznejši backpointer.

### Korak 2: parity-relative edge goal

Pred edge redukcijo uporabimo:

- normalen solved goal brez parityja;
- cross-solved `UF / UR` goal s parityjem.

Tako edge residue multiset na koncu nima parity terminala.

### Korak 3: pre-reduce vsak fizični cycle

Za vsak cycle:

1. prištej base comme;
2. če je closed, ga odstrani;
3. sicer shrani en typed residue record.

Residue record naj poleg tipa hrani še cycle ID in podatke za rekonstrukcijo
tracea.

### Korak 4: DP nad reduction graphom, ne samo nad atom partitionom

Za no-LTCT unit-weight total bi lahko atome obravnavali kot scalar-cost base
case. Za pravi produkcijski minimum to ni dovolj. Corner DP mora enumerirati
legalne redukcije in ohraniti njihove različne endpointe.

Konceptualno:

```text
best(reduced_state):
    če je state solved, vrni 0
    enumeriraj vsak legalen naslednji alg/reduction
    candidate = reduction_cost + best(reduction_result)
    vrni minimum in backpointer
```

En reduction korak:

- izbere konkretne residue oziroma kose, ki jih alg rešuje;
- če ni zadnji alg atoma, reši en ali dva kosa in pusti manjši zaprt primer;
- če je zadnji alg atoma, reši celoten preostanek: zadnje tri pri klasičnem
  3-cyclu oziroma zadnja dva pri 2-flipu ali 2-twistu;
- vrne manjši residue state oziroma solved state pri terminalnem koraku;
- lahko proizvede različne končne oblike, če isti atom začnemo reševati v
  drugem vrstnem redu.

Osnovni signature count-vector je še vedno majhen:

- edges: `(countF, countP, countPF)`;
- corners: `(countT+, countT-, countP0, countP+, countP-)`.

Corner state pa mora razlikovati finish-relevantne endpointe. Na primer veja, ki
po dveh algih pusti `T+ T-`, ne sme biti združena z vejo, ki po dveh algih
pusti zaprt 3-cycle, samo zato, ker imata obe brez LTCT še en zadnji alg.

Če concrete buffer/trace identiteta vpliva na naslednjo potezo, count-vectorju
dodamo samo najmanjši potrebni metadata; ni razloga za vrnitev na celoten
24-sticker DFS.

### Korak 5: vloga atom kataloga

Katalog 4 edge in 15 corner atomov ostane pomemben kot:

- dokaz, kateri minimalni residue sistemi so closed;
- seznam base/acceptance primerov;
- vir lower boundov in regresijskih testov;
- kontrola, da reduction graph ni izpustil nobenega fundamentalnega primera.

Ni pa seznam 19 nedeljivih makro-akcij z eno samo dovoljeno ceno/potjo.

### Korak 6: parity in LTCT/T2C terminal

- edge reduction state se mora zaključiti brez parity terminala;
- corner state se lahko zaključi z enim od 7 parity terminalov;
- DP mora dovoliti, da se corner reduction veja s terminalom poveže z LTCT/T2C
  akcijo, preden zavrže informacijo o twist endpointu;
- backpointer shrani dejanski vrstni red reduction korakov.

Število typed stanj in prehodov ostane majhno, zato bi moral biti tak search še
vedno praktično instant v primerjavi s sticker-state DFS-em.

### Implementirana poenostavitev: exact distance do finish seta

Za sam algcount ni treba ročno materializirati vseh LTCT-relevantnih reduction
vej. Implementacija eksplicitno generira vse konkretne one-alg končne state:

- `21` navadnih parity terminalov: UFR z enim od 7 drugih cornerjev in vsemi
  tremi legalnimi orientation razporeditvami `P0`;
- dodatnih `252` LTCT terminalov, kjer je UFR v `P` delu `P± T∓`;
- dodatnih `126` T2C terminalov, kjer je UFR `T` del istega sistema.

Finish set ima zato `21`, `273` oziroma `399` stateov za capability `none`,
`ltct` oziroma `t2c`.

Za parity scramble je finish-aware minimum:

```text
min(
  1 + min ordinary_distance(scramble, legal_parity_finish_state),
  1 + min ordinary_distance(scramble, legal_LTCT_or_T2C_finish_state)
)
```

Druga veja obstaja samo pri ustreznem capabilityju. Anonimni ordinary residue
minimum se uporablja kot lower bound, ne kot fizično veljaven parity finish.

Navadna razdalja med dvema parity stateoma je closed even-permutation problem,
zato jo rešuje isti residue katalog brez parity terminala. Generatorji so
simetrični, zato je ta metrika invariantna in zajame tudi poti, kjer se UFR med
redukcijo premakne iz začetnega `T` v končni `P`. Za hitrost se originalni
fizični cycli najprej reducirajo, rezultat pa memoizira po residue multiset-u in
možni primary residue vlogi. Na 250 konkretnih scramblih se hitri rezultat
ujema z neposredno enumeracijo vseh terminalov za oba capability levela.

---

## 9. Pomembna buffer caveata, ki je full-floating ne sme skriti

Algebraično closed cycle lahko takoj odstranimo po base costu samo, če imamo
legalen notranji buffer oziroma dokazano ekvivalentno realizacijo.

Trenutni UI »full floating« ni dobesedno vsak fizični piece:

### Corner buffer set

```text
UFR, UFL, UBR, UBL, RDF, FDL
```

Fizična `DBR` in `DBL` kosa nista notranja bufferja.

### Edge buffer set

```text
pseudoswap: UF, UR, UB, UL, FR, FL, DF, DB, DR, DL
weakswap:   UF, UR, UB, UL, FR, FL, DF, DB, DR, DL
```

Partial selections are prefixes of this order. Pseudoswap alone also permits
the explicit `UF + UB` selection without `UR`, preserving the learning-order
exception without giving the UI arbitrary subsets.

Fizična `BR` in `BL` kosa nista notranja bufferja.

Pri current full setu sta izključena samo po dva kosa. Vsak alg, ki sodeluje na
treh različnih kosih, zato nujno vsebuje vsaj en dovoljen buffer kos. Vseh
`C(8,3)` corner in `C(12,3)` edge trojic je to dodatno preverjeno v testu.

Cycle brez dovoljenega notranjega bufferja lahko vsebuje samo podmnožico dveh
izključenih kosov. Zato je dolg največ `2` in njegov base cost je `0`: ostane
kot navaden typed residue, ki se nato legalno poveže prek ene od trojic z
dovoljenim bufferjem. Poseben external doplačilni razred za full set ni
potreben.

Prav tako je pomemben dovoljen **buffer sticker**, ne samo fizični kos: `RDF`
in `DFR` ne pomenita iste tracing orientacije.

Sticker identiteta je še vedno pomembna za poznejšo rekonstrukcijo mema, ne pa
za unit-weight full-floating minimum.

---

## 10. Preostali implementacijski koraki

IRL katalog, full-buffer coverage, selected-buffer generator search in
finish-aware algcount so implementirani. Odprto ostaja:

1. Partial weakswap ostaja na prejšnjem DLin searchu do ločenega reviewa
   weakswap pravil za singleton, partial in full izbire.
2. Exact singleton `UFR` corner in pseudoswap `UF` adapter sta v produkciji.
   Handwritten `t+t+t` truth je bil eksplicitno popravljen na dva alga in obe
   10k fixture datoteki se ujemata 10.000/10.000. Singleton weakswap edges
   ostajajo legacy do ločenega reviewa.
3. Če želimo vrniti dejanski optimized memo, morajo class-graph prehodi dobiti
   cycle identitete, konkretne stickerje in backpointerje. Trenutni production
   rezultat namenoma vrne cost/class dokaz, ne izmišljenega segment tracea.

---

## 11. Obvezni regresijski in dokazni testi

Pred zamenjavo sedanjega planerja:

- zakleni kontraprimer dveh oriented corner 2-swapov: rezultat residua mora
  biti 2, ne 1;
- dodaj sintetičen state za vsak od 4 edge atomov;
- dodaj sintetičen state za vseh 15 corner closed atomov;
- dodaj sintetičen state za vseh 7 parity terminalov;
- za vsak atom preveri signature in potrjeni IRL total;
- za vsakega od vseh 6 eksplicitnih trojčkov in 6 eksplicitnih četvorčkov
  enumeriraj vse različne reduction endpointe, ne samo enega najcenejšega;
- posebej zakleni obe poti `T+ P+ P+` in `T+ P0 P-`: 2-twist ter zaprt
  3-cycle;
- pri `P0 P+ P+ P+` eksplicitno preveri vse štiri navedene trojčke in zrcalni
  `P0 P- P- P-` primer;
- dodaj primere, kjer dve brez-finish enakovredni poti zaradi LTCT/T2C ne data istega
  globalnega minimuma;
- če implementacija vrača optimized memo, preveri tudi rekonstruiran trace;
- posebej testiraj `k = 1` flips/twists;
- posebej testiraj cycle brez dovoljenega notranjega bufferja;
- testiraj vse tri capability levele `none`, `ltct`, `t2c`;
- production `UFR / UF` mora ostati identičen stored handwritten truthu;
- novi full-floating DP primerjaj z exhaustive majhnim oracle searchom, ne s
  trenutno napačno odd-segment cost formulo.

---

## 12. Jedro dogovora v enem odstavku

Za full floating fizične cycle najprej neodvisno reduciramo na base comme in
enega od 3 edge oziroma 5 corner residue tipov. Nevtralne cycle odstranimo.
Preostale residue z majhnim memoiziranim DP-jem razdelimo med popoln katalog 4
edge oziroma 15 corner minimalnih closed atomov; corners dovolijo še natanko 7
minimalnih parity terminalov. Atom katalog določa zaprte sisteme in njihove
potrjene totale, izvedba pa mora iskati po večpotnem reduction graphu. Vsak alg
pred zadnjim reši en ali dva kosa in pusti manjši zaprt primer; zaključni alg
katerega koli atoma reši celoten ostanek — zadnje tri pri klasičnem 3-cyclu ali
zadnja dva pri 2-flipu oziroma 2-twistu. Vrstni red lahko pusti 2-twist, zaprt
3-cycle ali drug finish-relevanten endpoint. To odpravi dragi sticker-state DFS
in, še
pomembneje, zamenja napačno pravilo, da vsak par odd segmentov avtomatsko
prihrani en alg. Matematični katalog in IRL costi so človekovo potrjeni.
Finish-aware minimum je implementiran kot exact razdalja do eksplicitnega seta
navadnih parity, LTCT in T2C terminalov, zato niti UFR eligibilityja niti
primary-role propagacije ni treba ugibati. Za weight `>= 1` scalar residue
razcep zamenja exhaustive Pareto katalog vseh 302 edge in 140 corner physical
cycle razredov; tako daljši cycle ne izgubi comm/orientation alternative.
Odd-permutation corner state dodatno uporablja vseh 416 UFR-rooted razredov in ločene Pareto
frontiere za `none`, `ltct` in `t2c`, zato je tudi izbira finisha eksaktna pri
poljubnem podprtem twist weightu.
Full-buffer coverage je dokazan, ne predpostavljen. Exact partial pseudoswap
uporablja isti generator princip z `B/N` označenimi fizičnimi cycli in
UFR-rooted `P` oznako za parity/LTCT/T2C. Preostali odprti področji sta
weakswap review in rekonstrukcija konkretnega optimized mema.
