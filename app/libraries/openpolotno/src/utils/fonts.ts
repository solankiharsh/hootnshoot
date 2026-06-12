// @ts-nocheck
'use client';

import * as mobx from 'mobx';
import { triggerLoadError, getFontLoadTimeout } from './loader';

const TEST_TEXT = 'Some test text;?#D-ПРИВЕТ!1230o9u8i7y6t5r4e3w2q1';

let _googleFonts = mobx.observable([
  'ABeeZee', 'Abel', 'Abhaya Libre', 'Abril Fatface', 'Acme', 'Actor', 'Adamina', 'Advent Pro',
  'Alegreya', 'Alegreya Sans', 'Alegreya SC', 'Alfa Slab One', 'Alice', 'Alike', 'Allan',
  'Allerta', 'Allura', 'Almendra', 'Amatic SC', 'Amiko', 'Amiri', 'Anaheim', 'Andada Pro',
  'Andika', 'Angkor', 'Annie Use Your Telescope', 'Anonymous Pro', 'Antic', 'Antic Didone',
  'Anton', 'Arapey', 'Arbutus', 'Arbutus Slab', 'Architects Daughter', 'Archivo',
  'Archivo Black', 'Archivo Narrow', 'Arial', 'Arizonia', 'Armata', 'Arsenal', 'Arvo',
  'Arya', 'Asap', 'Asap Condensed', 'Assistant', 'Astloch', 'Asul', 'Athiti', 'Atkinson Hyperlegible',
  'Atma', 'Averia Gruesa Libre', 'Averia Libre', 'Averia Sans Libre', 'Averia Serif Libre',
  'B612', 'B612 Mono', 'Bad Script', 'Baloo 2', 'Balthazar', 'Barlow', 'Barlow Condensed',
  'Barlow Semi Condensed', 'Basic', 'Baskervville', 'Battambang', 'Bayon', 'Be Vietnam Pro',
  'Bebas Neue', 'Belgrano', 'Belleza', 'Bellota', 'BenchNine', 'Bentham', 'Berkshire Swash',
  'Beth Ellen', 'Bigelow Rules', 'Bigshot One', 'Bilbo', 'BioRhyme', 'Birthstone',
  'Bitter', 'Black Han Sans', 'Black Ops One', 'Blinker', 'Bodoni Moda', 'Boogaloo',
  'Bowlby One', 'Brawler', 'Bree Serif', 'Brygada 1918', 'Bubblegum Sans', 'Buda',
  'Buenard', 'Bungee', 'Bungee Inline', 'Bungee Shade', 'Butcherman', 'Butterfly Kids',
  'Cabin', 'Cabin Condensed', 'Cabin Sketch', 'Caesar Dressing', 'Cagliostro', 'Cairo',
  'Caladea', 'Calistoga', 'Calligraffitti', 'Cambay', 'Cambo', 'Candal', 'Cantarell',
  'Cantata One', 'Cantora One', 'Capriola', 'Cardo', 'Carme', 'Carrois Gothic',
  'Carter One', 'Castoro', 'Catamaran', 'Caudex', 'Caveat', 'Caveat Brush',
  'Cedarville Cursive', 'Ceviche One', 'Chakra Petch', 'Changa', 'Chango', 'Charm',
  'Charmonman', 'Chathura', 'Chau Philomene One', 'Chela One', 'Chelsea Market',
  'Cherry Cream Soda', 'Cherry Swash', 'Chewy', 'Chicle', 'Chilanka', 'Chivo',
  'Chonburi', 'Cinzel', 'Cinzel Decorative', 'Clicker Script', 'Coda', 'Codystar',
  'Coiny', 'Combo', 'Comfortaa', 'Comic Neue', 'Coming Soon', 'Commissioner',
  'Concert One', 'Condiment', 'Content', 'Contrail One', 'Convergence', 'Cookie',
  'Copse', 'Corben', 'Cormorant', 'Cormorant Garamond', 'Cormorant Infant',
  'Cormorant SC', 'Cormorant Unicase', 'Cormorant Upright', 'Courgette', 'Courier Prime',
  'Cousine', 'Crete Round', 'Crimson Pro', 'Crimson Text', 'Croissant One', 'Crushed',
  'Cuprum', 'Cute Font', 'Cutive', 'Cutive Mono',
  'DM Mono', 'DM Sans', 'DM Serif Display', 'DM Serif Text',
  'Dancing Script', 'Dangrek', 'Darker Grotesque', 'David Libre', 'Dawning of a New Day',
  'Days One', 'Dekko', 'Delius', 'Delius Swash Caps', 'Della Respira', 'Denk One',
  'Devonshire', 'Dhurjati', 'Didact Gothic', 'Diplomata', 'Diplomata SC',
  'DoBold', 'Dokdo', 'Domine', 'Donegal One', 'Doppio One', 'Dorsa', 'Dosis',
  'DotGothic16', 'Dr Sugiyama', 'Duru Sans', 'Dynalight',
  'EB Garamond', 'Eagle Lake', 'East Sea Dokdo', 'Eater', 'Economica', 'Eczar',
  'El Messiri', 'Electrolize', 'Elsie', 'Emilys Candy', 'Encode Sans', 'Encode Sans Condensed',
  'Encode Sans Expanded', 'Encode Sans Semi Condensed', 'Encode Sans Semi Expanded',
  'Engagement', 'Englebert', 'Enriqueta', 'Epilogue', 'Erica One', 'Esteban', 'Euphoria Script',
  'Ewert', 'Exo', 'Exo 2', 'Expletus Sans', 'Explora',
  'Fahkwang', 'Fanwood Text', 'Farro', 'Farsan', 'Fascinate', 'Fascinate Inline',
  'Faster One', 'Fauna One', 'Faustina', 'Federant', 'Federo', 'Felipa', 'Fenix',
  'Festive', 'Finger Paint', 'Finlandica', 'Fira Code', 'Fira Mono', 'Fira Sans',
  'Fira Sans Condensed', 'Fira Sans Extra Condensed', 'Fjalla One', 'Fjord One',
  'Flamenco', 'Flavors', 'Fleur De Leah', 'Flow Block', 'Flow Circular', 'Flow Rounded',
  'Fondamento', 'Fontdiner Swanky', 'Forum', 'Francois One', 'Frank Ruhl Libre',
  'Fraunces', 'Freckle Face', 'Fredericka the Great', 'Fredoka', 'Fredoka One',
  'Fresca', 'Frijole', 'Fruktur', 'Fugaz One', 'Fuggles', 'Fuzzy Bubbles',
  'GFS Didot', 'GFS Neohellenic', 'Gabriela', 'Gaegu', 'Gafata', 'Galada',
  'Galdeano', 'Galindo', 'Gamja Flower', 'Gantari', 'Gayathri', 'Gelasio',
  'Gemunu Libre', 'Genos', 'Gentium Book Basic', 'Gentium Plus',
  'Geo', 'Georama', 'Geostar', 'Geostar Fill', 'Germania One', 'Gidugu',
  'Gilda Display', 'Girassol', 'Give You Glory', 'Glass Antiqua', 'Glegoo',
  'Gloria Hallelujah', 'Glory', 'Gluten', 'Goblin One', 'Gochi Hand', 'Goldman',
  'Gorditas', 'Gothic A1', 'Gotu', 'Goudy Bookletter 1911', 'Graduate', 'Grand Hotel',
  'Grandstander', 'Gravitas One', 'Great Vibes', 'Grechen Fuemen', 'Grenze',
  'Grenze Gotisch', 'Grey Qo', 'Griffy', 'Gruppo', 'Gudea', 'Gugi', 'Gupter',
  'Gurajada', 'Gwendolyn',
  'Habibi', 'Hammersmith One', 'Handlee', 'Hanuman', 'Happy Monkey', 'Harmattan',
  'Headland One', 'Heebo', 'Helvetica Neue', 'Henny Penny', 'Hepta Slab', 'Herr Von Muellerhoff',
  'Hi Melody', 'Hina Mincho', 'Holtwood One SC', 'Homemade Apple', 'Homenaje',
  'Hubballi', 'Hurricane',
  'IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Sans Arabic', 'IBM Plex Sans Condensed',
  'IBM Plex Sans Devanagari', 'IBM Plex Serif', 'IM Fell DW Pica', 'Ibarra Real Nova',
  'Iceberg', 'Iceland', 'Imbue', 'Imperial Script', 'Imprima', 'Inconsolata',
  'Inder', 'Indie Flower', 'Inika', 'Inknut Antiqua', 'Inria Sans', 'Inria Serif',
  'Inspiration', 'Inter', 'Inter Tight', 'Irish Grover', 'Island Moments', 'Istok Web',
  'Italiana', 'Italianno', 'Itim',
  'Jacques Francois', 'Jacques Francois Shadow', 'Jaldi', 'JetBrains Mono', 'Jim Nightshade',
  'Joan', 'Jockey One', 'Josefin Sans', 'Josefin Slab', 'Jost', 'Jua', 'Judson',
  'Julee', 'Julius Sans One', 'Junge', 'Jura', 'Just Another Hand', 'Just Me Again Down Here',
  'K2D', 'Kadwa', 'Kaisei Decol', 'Kaisei HarunoUmi', 'Kaisei Opti', 'Kaisei Tokumin',
  'Kalam', 'Kameron', 'Kanit', 'Kantumruy Pro', 'Karantina', 'Karla', 'Karma',
  'Katibeh', 'Kaushan Script', 'Kavoon', 'Kdam Thmor Pro', 'Keania One', 'Kelly Slab',
  'Kenia', 'Khand', 'Khmer', 'Khula', 'Kirang Haerang', 'Kite One', 'Kiwi Maru',
  'Klee One', 'Knewave', 'KoHo', 'Kodchasan', 'Koh Santepheap', 'Kolker Brush',
  'Kosugi', 'Kosugi Maru', 'Kotta One', 'Koulen', 'Kranky', 'Kreon', 'Kristi',
  'Krona One', 'Kufam', 'Kumar One', 'Kumar One Outline', 'Kumbh Sans', 'Kurale',
  'La Belle Aurore', 'Lacquer', 'Laila', 'Lakki Reddy', 'Lalezar', 'Lancelot',
  'Langar', 'Lateef', 'Lato', 'Lavishly Yours', 'League Gothic', 'League Script',
  'League Spartan', 'Leckerli One', 'Ledger', 'Lekton', 'Lemon', 'Lemonada',
  'Lexend', 'Lexend Deca', 'Lexend Exa', 'Lexend Giga', 'Lexend Mega', 'Lexend Peta',
  'Lexend Tera', 'Lexend Zetta', 'Libre Barcode 128', 'Libre Barcode 39', 'Libre Baskerville',
  'Libre Caslon Display', 'Libre Caslon Text', 'Libre Franklin', 'Life Savers',
  'Lilita One', 'Lily Script One', 'Limelight', 'Linden Hill', 'Literata', 'Livvic',
  'Lobster', 'Lobster Two', 'Londrina Outline', 'Londrina Shadow', 'Londrina Sketch',
  'Londrina Solid', 'Long Cang', 'Lora', 'Love Light', 'Love Ya Like A Sister',
  'Loved by the King', 'Lovers Quarrel', 'Luckiest Guy', 'Lugrasimo', 'Lumanosimo',
  'Lunasima', 'Lusitana', 'Lustria', 'Luxurious Roman', 'Luxurious Script',
  'M PLUS 1', 'M PLUS 1 Code', 'M PLUS 1p', 'M PLUS 2', 'M PLUS Code Latin',
  'M PLUS Rounded 1c', 'Macondo', 'Macondo Swash Caps', 'Mada',
  'Magra', 'Maiden Orange', 'Maitree', 'Major Mono Display', 'Mako', 'Mali',
  'Mallanna', 'Mandali', 'Manjari', 'Manrope', 'Mansalva', 'Manuale', 'Marcellus',
  'Marcellus SC', 'Marck Script', 'Margarine', 'Markazi Text', 'Marko One',
  'Marmelad', 'Martel', 'Martel Sans', 'Marvel', 'Mate', 'Mate SC', 'Maven Pro',
  'McLaren', 'Mea Culpa', 'Meddon', 'MedievalSharp', 'Medula One', 'Megrim',
  'Meie Script', 'Merienda', 'Merriweather', 'Merriweather Sans', 'Metal Mania',
  'Metamorphous', 'Metrophobic', 'Michroma', 'Midnight Dream', 'Milonga',
  'Miltonian', 'Miltonian Tattoo', 'Mina', 'Miniver', 'Miriam Libre', 'Mirza',
  'Miss Fajardose', 'Mitr', 'Mochiy Pop One', 'Mochiy Pop P One', 'Mogra',
  'Mohave', 'Molengo', 'Monda', 'Monofett', 'Monoton', 'Monsieur La Doulaise',
  'Montaga', 'Montez', 'Montserrat', 'Montserrat Alternates', 'Montserrat Subrayada',
  'Moo Lah Lah', 'Moon Dance', 'Moul', 'Moulpali', 'Mountains of Christmas',
  'Mouse Memoirs', 'Mr Bedfort', 'Mr Dafoe', 'Mr De Haviland', 'Mrs Saint Delafield',
  'Mrs Sheppards', 'Mukta', 'Mukta Mahee', 'Mukta Malar', 'Mukta Vaani',
  'Mulish', 'Murecho', 'MuseoModerno',
  'NTR', 'Nanum Brush Script', 'Nanum Gothic', 'Nanum Gothic Coding', 'Nanum Myeongjo',
  'Nanum Pen Script', 'Natasha', 'Neonderthaw', 'Nerko One', 'Neucha', 'Neuton',
  'New Rocker', 'New Tegomin', 'News Cycle', 'Newsreader', 'Niconne', 'Niramit',
  'Nixie One', 'Nobile', 'Nokora', 'Norican', 'Nosifer', 'Notable', 'Nothing You Could Do',
  'Noticia Text', 'Noto Color Emoji', 'Noto Emoji', 'Noto Kufi Arabic', 'Noto Music',
  'Noto Naskh Arabic', 'Noto Sans', 'Noto Sans Display', 'Noto Serif', 'Noto Serif Display',
  'Nova Cut', 'Nova Flat', 'Nova Mono', 'Nova Oval', 'Nova Round', 'Nova Script',
  'Nova Slim', 'Nova Square', 'Numans', 'Nunito', 'Nunito Sans',
  'Odibee Sans', 'Odor Mean Chey', 'Offside', 'Oi', 'Old Standard TT', 'Oldenburg',
  'Ole', 'Oleo Script', 'Oleo Script Swash Caps', 'Oooh Baby', 'Open Sans',
  'Oranienbaum', 'Orbitron', 'Oregano', 'Orelega One', 'Orienta', 'Original Surfer',
  'Oswald', 'Outfit', 'Over the Rainbow', 'Overlock', 'Overlock SC', 'Overpass',
  'Overpass Mono', 'Ovo', 'Oxanium', 'Oxygen', 'Oxygen Mono',
  'PT Mono', 'PT Sans', 'PT Sans Caption', 'PT Sans Narrow', 'PT Serif', 'PT Serif Caption',
  'Pacifico', 'Padauk', 'Palanquin', 'Palanquin Dark', 'Pangolin', 'Paprika',
  'Parisienne', 'Passero One', 'Passion One', 'Pathway Extreme', 'Pathway Gothic One',
  'Patrick Hand', 'Patrick Hand SC', 'Pattaya', 'Patua One', 'Pavanam', 'Paytone One',
  'Peddana', 'Peralta', 'Permanent Marker', 'Petemoss', 'Petit Formal Script',
  'Petrona', 'Philosopher', 'Piazzolla', 'Piedra', 'Pink Lemonade', 'Pinyon Script',
  'Pirata One', 'Pixelify Sans', 'Plaster', 'Play', 'Playball', 'Playfair Display',
  'Playfair Display SC', 'Plus Jakarta Sans', 'Podkova', 'Poiret One', 'Poller One',
  'Pompiere', 'Pontano Sans', 'Poor Story', 'Poppins', 'Potta One', 'Pragati Narrow',
  'Praise', 'Press Start 2P', 'Pridi', 'Princess Sofia', 'Prociono', 'Prompt',
  'Proza Libre', 'Public Sans', 'Puppies Play', 'Puritan', 'Purple Purse',
  'Quando', 'Quantico', 'Quattrocento', 'Quattrocento Sans', 'Questrial', 'Quicksand',
  'Quintessential', 'Qwigley', 'Qwitcher Grypen',
  'Racing Sans One', 'Radio Canada', 'Rajdhani', 'Rakkas', 'Raleway', 'Raleway Dots',
  'Ramabhadra', 'Ramaraja', 'Rambla', 'Rammetto One', 'Ranga', 'Rasa', 'Rationale',
  'Ravi Prakash', 'Readex Pro', 'Recursive', 'Red Hat Display', 'Red Hat Mono', 'Red Hat Text',
  'Red Rose', 'Redacted', 'Redacted Script', 'Reggae One', 'Revalia', 'Rhodium Libre',
  'Ribeye', 'Ribeye Marrow', 'Righteous', 'Risque', 'Road Rage', 'Roboto',
  'Roboto Condensed', 'Roboto Flex', 'Roboto Mono', 'Roboto Serif', 'Roboto Slab',
  'Rochester', 'Rock 3D', 'Rock Salt', 'RocknRoll One', 'Rokkitt', 'Romanesco',
  'Ropa Sans', 'Rosario', 'Rosarivo', 'Rouge Script', 'Rowdies', 'Rozha One',
  'Rubik', 'Rubik 80s Fade', 'Rubik Beastly', 'Rubik Bubbles', 'Rubik Burned',
  'Rubik Dirt', 'Rubik Distressed', 'Rubik Gemstones', 'Rubik Glitch', 'Rubik Iso',
  'Rubik Maps', 'Rubik Microbe', 'Rubik Mono One', 'Rubik Moonrocks', 'Rubik One',
  'Rubik Pixels', 'Rubik Puddles', 'Rubik Scribble', 'Rubik Spray Paint', 'Rubik Storm',
  'Rubik Vinyl', 'Rubik Wet Paint', 'Ruda', 'Rufina', 'Ruge Boogie', 'Ruluko',
  'Rum Raisin', 'Ruslan Display', 'Russo One', 'Ruthie', 'Rye',
  'STIX Two Text', 'Sacramento', 'Sahitya', 'Sail', 'Saira', 'Saira Condensed',
  'Saira Extra Condensed', 'Saira Semi Condensed', 'Saira Stencil One', 'Salsa',
  'Sanchez', 'Sancreek', 'Sansita', 'Sansita Swashed', 'Sarabun', 'Sarala',
  'Sarina', 'Sarpanch', 'Sassy Frass', 'Satisfy', 'Sawarabi Gothic', 'Sawarabi Mincho',
  'Scada', 'Scheherazade New', 'Secular One', 'Sedgwick Ave', 'Sedgwick Ave Display',
  'Sen', 'Sevillana', 'Seymour One', 'Shadows Into Light', 'Shadows Into Light Two',
  'Shalimar', 'Share', 'Share Tech', 'Share Tech Mono', 'Shippori Antique',
  'Shippori Mincho', 'Shippori Mincho B1', 'Shizuru', 'Shrikhand', 'Siemreap',
  'Sigmar', 'Sigmar One', 'Signika', 'Signika Negative', 'Silkscreen', 'Simonetta',
  'Single Day', 'Sintony', 'Sirin Stencil', 'Six Caps', 'Skranji', 'Slabo 13px',
  'Slabo 27px', 'Slackey', 'Slee', 'Smooch', 'Smooch Sans', 'Smythe', 'Sniglet',
  'Snippet', 'Snowburst One', 'Sofadi One', 'Sofia', 'Sofia Sans', 'Sofia Sans Condensed',
  'Sofia Sans Extra Condensed', 'Sofia Sans Semi Condensed', 'Solitreo', 'Solway',
  'Song Myung', 'Sono', 'Sonsie One', 'Sora', 'Sorts Mill Goudy', 'Source Code Pro',
  'Source Sans 3', 'Source Serif 4', 'Space Grotesk', 'Space Mono', 'Spectral',
  'Spectral SC', 'Spicy Rice', 'Spinnaker', 'Spirax', 'Splash', 'Spline Sans',
  'Spline Sans Mono', 'Squada One', 'Square Peg', 'Sree Krushnadevaraya', 'Sriracha',
  'Srisakdi', 'Staatliches', 'Stardos Stencil', 'Stick', 'Stick No Bills', 'Stint Ultra Condensed',
  'Stint Ultra Expanded', 'Stoke', 'Strait', 'Style Script', 'Stylish', 'Sue Ellen Francisco',
  'Suez One', 'Sulphur Point', 'Sumana', 'Sunflower', 'Sunshiney', 'Supermercado One',
  'Sura', 'Suranna', 'Suravaram', 'Suwannaphum', 'Swanky and Moo Moo',
  'Syncopate', 'Syne', 'Syne Mono', 'Syne Tactile',
  'Tai Heritage Pro', 'Tajawal', 'Tangerine', 'Tapestry', 'Taprom', 'Tauri',
  'Taviraj', 'Teko', 'Telex', 'Tenali Ramakrishna', 'Tenor Sans', 'Text Me One',
  'Texturina', 'Thasadith', 'The Girl Next Door', 'The Nautigal', 'Tienne',
  'Tillana', 'Tilt Neon', 'Tilt Prism', 'Tilt Warp', 'Timmana', 'Tinos', 'Titan One',
  'Titillium Web', 'Tomorrow', 'Tourney', 'Trade Winds', 'Train One', 'Trirong',
  'Trispace', 'Trocchi', 'Trochut', 'Truculenta', 'Trykker', 'Tulpen One', 'Turret Road',
  'Twinkle Star', 'Ubuntu', 'Ubuntu Condensed', 'Ubuntu Mono', 'Uchen', 'Ultra',
  'Unbounded', 'Uncial Antiqua', 'Underdog', 'Unica One', 'UnifrakturCook',
  'UnifrakturMaguntia', 'Unkempt', 'Unlock', 'Unna', 'Updock', 'Urbanist',
  'VT323', 'Vampiro One', 'Varela', 'Varela Round', 'Vast Shadow', 'Vazirmatn',
  'Vesper Libre', 'Viaoda Libre', 'Vibes', 'Vibur', 'Vidaloka', 'Viga', 'Vina Sans',
  'Voces', 'Volkhov', 'Vollkorn', 'Vollkorn SC', 'Voltaire',
  'Waiting for the Sunrise', 'Wallpoet', 'Walter Turncoat', 'Warnes', 'Water Brush',
  'Waterfall', 'Wellfleet', 'Wendy One', 'Whisper', 'WindSong', 'Wire One',
  'Wit', 'Work Sans', 'Xanh Mono', 'Yaldevi', 'Yanone Kaffeesatz', 'Yantramanav',
  'Yatra One', 'Yellowtail', 'Yeon Sung', 'Yeseva One', 'Yesteryear',
  'Yomogi', 'Young Serif', 'Yrsa', 'Yuji Boku', 'Yuji Mai', 'Yuji Syuku', 'Yusei Magic',
  'ZCOOL KuaiLe', 'ZCOOL QingKe HuangYou', 'ZCOOL XiaoWei', 'Zen Antique',
  'Zen Antique Soft', 'Zen Dots', 'Zen Kaku Gothic Antique', 'Zen Kaku Gothic New',
  'Zen Kurenaido', 'Zen Loop', 'Zen Maru Gothic', 'Zen Old Mincho', 'Zen Tokyo Zoo',
  'Zeyada', 'Zhi Mang Xing', 'Zilla Slab', 'Zilla Slab Highlight',
]);
let _googleFontsChanged = mobx.observable({ value: false });

export function isGoogleFontChanged(): boolean { return _googleFontsChanged.value; }

export function setGoogleFonts(fonts: string[] | 'default') {
  if (fonts === 'default') {
    _googleFontsChanged.value = false;
  } else {
    _googleFontsChanged.value = true;
    _googleFonts.splice(0, _googleFonts.length);
    _googleFonts.push(...fonts);
  }
}

export function getFontsList(): string[] { return [...new Set(_googleFonts)]; }

export const globalFonts = mobx.observable<any[]>([]);
export function addGlobalFont(font: any) { globalFonts.push(font); }
export function removeGlobalFont(fontFamily: string) {
  const idx = globalFonts.findIndex((f) => f.fontFamily === fontFamily);
  if (idx !== -1) globalFonts.splice(idx, 1);
}
export function replaceGlobalFonts(fonts: any[]) { globalFonts.replace(fonts); }

let _measureCanvas: HTMLCanvasElement | undefined;
function measureText(family: string, fallback = 'sans-serif', style = 'normal', weight = 'normal'): number {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d')!;
  ctx.font = `${style} ${weight} 40px '${family}', ${fallback}`;
  return ctx.measureText(TEST_TEXT).width;
}

export function measureFontDom(
  family: string,
  fallback = 'sans-serif',
  style = 'normal',
  weight = 'normal',
): number {
  if (typeof document === 'undefined' || !document.body) return 0;
  const span = document.createElement('span');
  span.textContent = TEST_TEXT;
  span.style.cssText = `
    position:absolute;
    visibility:hidden;
    white-space:nowrap;
    top:-9999px;
    left:-9999px;
    font:${style} ${weight} 90px '${family}', ${fallback};
  `;
  document.body.appendChild(span);
  const width = span.getBoundingClientRect().width;
  span.remove();
  return width;
}

const _loadedFonts: Record<string, boolean> = { Arial: true };

export const isFontLoaded = (family: string): boolean =>
  Object.keys(_loadedFonts).some((k) => k.startsWith(family + '_')) || !!_loadedFonts[family];

function measureSans(style = 'normal', weight = 'normal'): number {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d')!;
  ctx.font = `${style} ${weight} 40px sans-serif`;
  return ctx.measureText(TEST_TEXT).width;
}

function measureSerif(style = 'normal', weight = 'normal'): number {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d')!;
  ctx.font = `${style} ${weight} 40px serif`;
  return ctx.measureText(TEST_TEXT).width;
}

export async function loadFont(
  family: string,
  style: string,
  weight: string,
  text = '',
): Promise<void> {
  const key = `${family}_${style}_${weight}`;
  if (_loadedFonts[key]) return;

  const hasFontAPI = !!(document.fonts?.load);
  const baselineSans = measureSans(style, weight);

  if (hasFontAPI) {
    try {
      await document.fonts.load(`${style} ${weight} 16px '${family}'`);
      if (baselineSans !== measureText(family, 'sans-serif', style, weight)) {
        _loadedFonts[key] = true;
        return;
      }
    } catch { /* fallback to polling */ }
  }

  const baselineSerif = measureSerif(style, weight);
  const initialWidth = measureText(family, 'sans-serif', style, weight);
  const maxIterations = Math.min(6000, getFontLoadTimeout()) / 60;

  for (let i = 0; i < maxIterations; i++) {
    const sansMeasure = measureText(family, 'sans-serif', style, weight);
    const serifMeasure = measureText(family, 'serif', style, weight);
    if (sansMeasure !== initialWidth || sansMeasure !== baselineSans || serifMeasure !== baselineSerif) {
      await new Promise((r) => setTimeout(r, 100));
      _loadedFonts[key] = true;
      return;
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  console.warn(`Timeout for loading font "${family}". Looks like raeditor can't load it. Is it a correct font family?`);
  triggerLoadError(`Timeout for loading font "${family}"`);
}

const _injectedGoogle: Record<string, boolean> = {};
let _googleFontsVariants = '400,400italic,700,700italic';

export function setGoogleFontsVariants(variants: string) { _googleFontsVariants = variants; }
export function getGoogleFontsVariants(): string { return _googleFontsVariants; }
export function getGoogleFontsUrl(family: string): string {
  return `https://fonts.googleapis.com/css?family=${family.replace(/ /g, '+')}:${_googleFontsVariants}`;
}

export function injectGoogleFont(family: string) {
  if (_injectedGoogle[family]) return;
  const url = getGoogleFontsUrl(family);
  const link = document.createElement('link');
  link.type = 'text/css';
  link.href = url;
  link.rel = 'stylesheet';
  document.getElementsByTagName('head')[0].appendChild(link);
  _injectedGoogle[family] = true;
}

const _injectedCustom: Record<string, boolean> = {};
let _fontStyleEl: HTMLStyleElement | undefined;

export function injectCustomFont(font: {
  fontFamily: string;
  url?: string;
  styles?: Array<{ src: string; fontStyle?: string; fontWeight?: string }>;
}) {
  const { fontFamily } = font;
  if (_injectedCustom[fontFamily]) return;
  if (!font.url && !font.styles) return;

  const styles = font.styles || (font.url ? [{ src: `url("${font.url}")` }] : []);

  if (!_fontStyleEl) {
    _fontStyleEl = document.getElementById('raeditor-font-style') as HTMLStyleElement;
    if (!_fontStyleEl) {
      _fontStyleEl = document.createElement('style');
      _fontStyleEl.id = 'raeditor-font-style';
      document.head.appendChild(_fontStyleEl);
    }
  }

  const sheet = _fontStyleEl.sheet!;
  styles.forEach((style) => {
    sheet.insertRule(
      `
    @font-face{
      font-family:'${fontFamily}';
      src:${style.src};
      font-style:${style.fontStyle || 'normal'};
      font-weight:${style.fontWeight || 'normal'};
      font-display:swap;
    }`,
      sheet.cssRules.length,
    );
  });

  _injectedCustom[fontFamily] = true;
}
