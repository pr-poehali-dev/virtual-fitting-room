/**
 * Базовые цветовые палитры для 4 сезонов (обычные и яркие варианты)
 * Каждый сезон содержит 3 палитры
 */

export interface ColorPalette {
  [key: string]: string;
}

export interface SeasonPalettes {
  palette1: ColorPalette;
  palette2: ColorPalette;
  palette3: ColorPalette;
}

export interface SeasonalPalettesData {
  summer: SeasonPalettes;
  summerBright: SeasonPalettes;
  autumn: SeasonPalettes;
  autumnBright: SeasonPalettes;
  winter: SeasonPalettes;
  winterBright: SeasonPalettes;
  spring: SeasonPalettes;
  springBright: SeasonPalettes;
  summerSoft: SeasonPalettes;
  autumnVivid: SeasonPalettes;
  winterVivid: SeasonPalettes;
  springGentle: SeasonPalettes;
}

export const seasonalPalettes: SeasonalPalettesData = {
  // ========== ЛЕТО (обычное) ==========
  summer: {
    palette1: {
      'dark-raspberry': '#922455ff',
      'old-rose': '#cb93abff',
      'rosewood': '#ad4d72ff',
      'thistle': '#d2b4beff',
      'blush-rose': '#be6682ff',
      'cherry-rose': '#af1845ff',
      'dust-grey': '#d8cfd1ff',
      'carmine': '#af283fff',
      'ruby-red': '#a11d2bff',
      'burgundy': '#6c171fff',
    },
    palette2: {
      'deep-crimson': '#971c20ff',
      'clay-soil': '#763e36ff',
      'smoky-rose': '#865e58ff',
      'silver': '#cfc5c3ff',
      'bone': '#d0c8bbff',
      'tropical-teal': '#6f9f9fff',
      'teal': '#0a7d88ff',
      'pacific-cyan': '#2e909dff',
      'powder-blue': '#b0bfcbff',
      'powder-blue-2': '#98adc2ff',
    },
    palette3: {
      'dusk-blue': '#2a4972ff',
      'wisteria-blue': '#869dc5ff',
      'slate-indigo': '#5065a4ff',
      'space-indigo-2': '#242c4bff',
      'space-indigo': '#2a3150ff',
      'lavender-grey': '#999fbbff',
      'pale-slate': '#b3b2c2ff',
      'amethyst-smoke': '#a287b0ff',
      'crimson-violet': '#591b44ff',
      'petal-pink': '#c185abff',
    },
  },

  // ========== ЛЕТО (яркое) ==========
  summerBright: {
    palette1: {
      'dark-raspberry': '#a01855ff',
      'sweet-peony': '#de82aaff',
      'hot-berry': '#c8326cff',
      'pink-mist': '#e1a2b7ff',
      'rose-punch': '#d44e79ff',
      'cherry-rose': '#b71042ff',
      'pastel-petal': '#e6c2c9ff',
      'carmine': '#bc1a35ff',
      'ruby-red': '#aa1322ff',
      'dark-wine': '#760f19ff',
    },
    palette2: {
      'deep-crimson': '#a11217ff',
      'chestnut': '#8a3124ff',
      'reddish-brown': '#a7483aff',
      'almond-silk': '#e0bab3ff',
      'pale-oak': '#e0cba9ff',
      'strong-cyan': '#4ec1c1ff',
      'teal': '#07828dff',
      'pacific-blue': '#1e9daeff',
      'powder-blue': '#9cc0ddff',
      'cool-horizon': '#83add8ff',
    },
    palette3: {
      'steel-azure': '#1c4882ff',
      'wisteria-blue': '#7298d9ff',
      'royal-azure': '#3557c0ff',
      'space-indigo': '#182558ff',
      'twilight-indigo': '#1b285fff',
      'wisteria-blue-2': '#8291d3ff',
      'soft-periwinkle': '#a19dd8ff',
      'lavender-purple': '#ac6bccff',
      'crimson-violet': '#631248ff',
      'petal-pink': '#d76fb1ff',
    },
  },

  // ========== ОСЕНЬ (обычная) ==========
  autumn: {
    palette1: {
      'dark-wine': '#761d1eff',
      'mahogany-red': '#be191dff',
      'mahogany-red-2': '#a71b1aff',
      'rich-mahogany': '#2e1010ff',
      'dark-wine-2': '#7c1913ff',
      'dark-wine-3': '#7b1a13ff',
      'brick-red': '#af4037ff',
      'espresso': '#461e16ff',
      'rusty-spice': '#c13d1eff',
      'red-ochre': '#c94722ff',
    },
    palette2: {
      'silver': '#ccbfb9ff',
      'deep-walnut': '#53331aff',
      'faded-copper': '#ad7e57ff',
      'khaki-beige': '#c2ad9bff',
      'dark-coffee': '#3b2a1aff',
      'ochre': '#c67313ff',
      'camel': '#ca985dff',
      'copperwood': '#b07311ff',
      'olive-bark': '#695a2fff',
      'metallic-gold': '#d5af25ff',
    },
    palette3: {
      'palm-leaf': '#909c3aff',
      'muted-teal': '#99a98eff',
      'fern': '#577345ff',
      'evergreen': '#11281bff',
      'blue-spruce': '#0b685dff',
      'deep-space-blue': '#11364bff',
      'prussian-blue': '#112035ff',
      'twilight-indigo': '#223367ff',
      'midnight-violet': '#341c3eff',
      'taupe-grey': '#6c5f66ff',
    },
  },

  // ========== ОСЕНЬ (яркая) ==========
  autumnBright: {
    palette1: {
      'rich-mahogany': '#370707ff',
      'mahogany-red': '#b11111ff',
      'crushed-berry': '#811315ff',
      'brick-ember': '#c61013ff',
      'blood-red': '#860f08ff',
      'blood-red-2': '#861108ff',
      'flag-red': '#c22e24ff',
      'dark-garnet': '#531509ff',
      'red-ochre-2': '#cd3614ff',
      'red-ochre': '#d43f16ff',
    },
    palette2: {
      'peach-fuzz': '#eab39aff',
      'dark-walnut': '#60300bff',
      'ochre': '#dc7928ff',
      'light-caramel': '#e5aa76ff',
      'deep-walnut': '#462a11ff',
      'ochre-2': '#ce740dff',
      'golden-apricot': '#dd994bff',
      'copperwood': '#b6750bff',
      'olive-bark': '#7a621fff',
      'metallic-gold': '#e2b618ff',
    },
    palette3: {
      'lime-moss': '#a0b126ff',
      'willow-green': '#93c770ff',
      'forest-green': '#518b2dff',
      'evergreen': '#0b2d1aff',
      'blue-spruce': '#076e62ff',
      'deep-space-blue': '#0b3751ff',
      'prussian-blue': '#072040ff',
      'imperial-blue': '#162e73ff',
      'dark-amethyst': '#391249ff',
      'berry-blush': '#a4286aff',
    },
  },

  // ========== ЗИМА (обычная) ==========
  winter: {
    palette1: {
      'rose-wine': '#ce3b6fff',
      'berry-lipstick': '#c33664ff',
      'sweet-peony': '#c67999ff',
      'soft-fawn': '#d3bf90ff',
      'dust-grey': '#cfcbc2ff',
      'silver': '#c3ccceff',
      'silver-2': '#c0cac9ff',
      'pale-slate': '#c3bbcaff',
      'pale-slate-2': '#bac2cfff',
      'pale-slate-3': '#cec3cbff',
    },
    palette2: {
      'burgundy': '#771826ff',
      'midnight-violet': '#211120ff',
      'midnight-violet-2': '#241937ff',
      'french-blue': '#1f3e84ff',
      'steel-azure': '#0f4791ff',
      'twitter-blue': '#0074b9ff',
      'baltic-blue': '#035ca5ff',
      'dark-slate-grey': '#1d3b3bff',
      'blue-spruce': '#076f66ff',
      'dark-emerald': '#0b6647ff',
    },
    palette3: {
      'cherry-rose': '#9d1544ff',
      'ruby-red': '#ab1a32ff',
      'intense-cherry': '#cd1b35ff',
      'prussian-blue': '#15162aff',
      'dust-grey': '#d1c8c6ff',
      'ink-black': '#09121bff',
      'graphite': '#363441ff',
      'lavender-grey': '#7d8298ff',
      'pale-slate': '#cacbcfff',
      'alabaster-grey': '#dedde3ff',
    },
  },

  // ========== ЗИМА (яркая) ==========
  winterBright: {
    palette1: {
      'cherry-rose': '#a50e43ff',
      'carmine': '#b6112cff',
      'flag-red': '#d4112eff',
      'prussian-blue': '#0d0f30ff',
      'almond-silk': '#e1beb7ff',
      'ink-black': '#06121eff',
      'space-indigo': '#292253ff',
      'slate-indigo': '#576abcff',
      'periwinkle': '#b8c0e0ff',
      'lavender': '#d8d4edff',
    },
    palette2: {
      'burgundy': '#7f1020ff',
      'midnight-violet': '#280b26ff',
      'dark-amethyst': '#221041ff',
      'french-blue': '#14398fff',
      'steel-azure': '#0a4694ff',
      'bright-teal-blue': '#0074b8ff',
      'baltic-blue': '#025ca6ff',
      'dark-teal': '#134444ff',
      'blue-spruce': '#057168ff',
      'dark-emerald': '#076948ff',
    },
    palette3: {
      'razzmatazz': '#df2a69ff',
      'raspberry-red': '#d7235fff',
      'sweet-peony': '#da6797ff',
      'soft-fawn': '#e3c682ff',
      'pearl-beige': '#e0d3b3ff',
      'light-blue': '#b3d8e0ff',
      'pearl-aqua': '#acdcd8ff',
      'wisteria': '#c4a8dcff',
      'powder-blue': '#a9bee0ff',
      'pink-orchid': '#e0b3d4ff',
    },
  },

  // ========== ВЕСНА (обычная) ==========
  spring: {
    palette1: {
      'flag-red': '#c6191fff',
      'magenta-bloom': '#d25167ff',
      'lobster-pink': '#ca5f6fff',
      'cotton-rose': '#d6b8b8ff',
      'vintage-lavender': '#775f92ff',
      'glaucous': '#6677a3ff',
      'french-blue': '#3c467aff',
      'blue-spruce': '#178070ff',
      'pacific-blue': '#69a6bbff',
      'pacific-blue-2': '#41afc7ff',
    },
    palette2: {
      'brick-ember': '#c21a1aff',
      'lobster-pink': '#d06863ff',
      'light-coral': '#d57c76ff',
      'powder-blush': '#e1b1a7ff',
      'tangerine-dream': '#e29875ff',
      'desert-sand': '#e3b6a0ff',
      'straw-gold': '#e4c468ff',
      'sea-green': '#428e4dff',
      'muted-teal': '#86b08aff',
      'dry-sage': '#c4ca96ff',
    },
    palette3: {
      'twilight-indigo': '#1b305bff',
      'baltic-blue': '#09589bff',
      'silver': '#bcb3adff',
      'chocolate-brown': '#9a5327ff',
      'copper': '#b87c46ff',
      'tan': '#d6b788ff',
      'powder-petal': '#e0d2cbff',
      'apricot-cream': '#e5ca93ff',
      'wheat': '#e5cda5ff',
      'bone': '#e0d5c9ff',
    },
  },

  // ========== ВЕСНА (яркая) ==========
  springBright: {
    palette1: {
      'twilight-indigo': '#122d64ff',
      'baltic-blue': '#06579dff',
      'desert-sand': '#d4af96ff',
      'rusty-spice': '#a95019ff',
      'ochre': '#d17a2eff',
      'soft-fawn': '#e5bb7bff',
      'almond-silk': '#ebcfc1ff',
      'apricot-cream': '#eecd8bff',
      'apricot-cream-2': '#eecf9bff',
      'almond-cream': '#ead4bdff',
    },
    palette2: {
      'brick-ember': '#ca1111ff',
      'lobster-pink': '#e15951ff',
      'vibrant-coral': '#e47068ff',
      'powder-blush': '#ecaa9dff',
      'tangerine-dream': '#ec936aff',
      'peach-fuzz': '#edb397ff',
      'royal-gold': '#eeca5eff',
      'medium-jungle': '#2ba63dff',
      'emerald': '#6bcc75ff',
      'pale-amber': '#d2dd83ff',
    },
    palette3: {
      'flag-red': '#d01016ff',
      'amaranth': '#e2415cff',
      'amaranth-2': '#dc4c61ff',
      'powder-blush': '#e4a9a9ff',
      'indigo-bloom': '#743eb2ff',
      'smart-blue': '#4669c3ff',
      'egyptian-blue': '#273990ff',
      'jungle-teal': '#0f8a78ff',
      'sky-surge': '#50b2d3ff',
      'sky-surge-2': '#2fbbdaff',
    },
  },

  // ========== ЛЕТО (мягкое / светлое) ==========
  summerSoft: {
    palette1: {
      'ocean-twilight': '#3c4e9fff',
      'french-blue': '#374b9dff',
      'sapphire-sky': '#3572c1ff',
      'powder-blue': '#9cb3dcff',
      'periwinkle': '#a9b1d7ff',
      'periwinkle-2': '#bdbcdbff',
      'rosy-copper': '#bf5343ff',
      'dusty-rose': '#bc776cff',
      'almond-silk': '#e2cfcbff',
      'soft-blush': '#e8d5d9ff',
    },
    palette2: {
      'intense-cherry': '#c22131ff',
      'primary-scarlet': '#e0252cff',
      'amaranth': '#de425cff',
      'scarlet-rush': '#e22b3dff',
      'old-rose': '#d8829dff',
      'pink-orchid': '#e0a7c0ff',
      'powder-blue': '#a9c2dbff',
      'strong-cyan': '#0dd0e1ff',
      'strong-cyan-2': '#43c5d6ff',
      'pearl-aqua': '#85c5c5ff',
    },
    palette3: {
      'glaucous': '#6d84caff',
      'raspberry-plum': '#af2982ff',
      'magenta-bloom': '#e92c65ff',
      'hot-berry': '#d8317cff',
      'sweet-peony': '#ce6d92ff',
      'lilac': '#da9ac3ff',
      'wisteria': '#be99d0ff',
      'bone': '#e2d7c4ff',
      'pastel-petal': '#e3bfccff',
      'pale-sky': '#bbcfe0ff',
    },
  },

  // ========== ОСЕНЬ (тёмная / насыщенная) ==========
  autumnVivid: {
    palette1: {
      'dark-garnet': '#6b130eff',
      'prussian-blue': '#0d1b30ff',
      'mauve-shadow': '#694457ff',
      'dark-garnet-2': '#6b140eff',
      'rich-mahogany': '#280c0cff',
      'rich-mahogany-2': '#3e1810ff',
      'deep-walnut': '#482a13ff',
      'toffee-brown': '#9f6a3eff',
      'camel': '#b9906eff',
      'rosy-taupe': '#be9b8bff',
    },
    palette2: {
      'mahogany-red': '#a41215ff',
      'twilight-indigo': '#192a5cff',
      'pine-teal': '#075c52ff',
      'deep-space-blue': '#0c2e42ff',
      'olive': '#818c2aff',
      'fern': '#476a32ff',
      'evergreen': '#0c2416ff',
      'sage-green': '#7ea563ff',
      'olive-bark': '#605022ff',
      'dark-coffee': '#372513ff',
    },
    palette3: {
      'deep-crimson': '#921313ff',
      'midnight-violet': '#2f143aff',
      'black-cherry': '#681517ff',
      'brown-red': '#9b3028ff',
      'rusty-spice': '#ae3919ff',
      'oxidized-iron': '#a93116ff',
      'copperwood': '#ac620eff',
      'bronze': '#c78335ff',
      'golden-earth': '#98630cff',
      'golden-bronze': '#b9971cff',
    },
  },

  // ========== ЗИМА (тёмная / насыщенная) ==========
  winterVivid: {
    palette1: {
      'dark-amaranth': '#890f3aff',
      'ruby-red': '#961329ff',
      'ruby-red-2': '#b1132aff',
      'prussian-blue': '#0f1025ff',
      'rosy-taupe': '#c1a09aff',
      'ink-black': '#070f18ff',
      'midnight-violet': '#2a253eff',
      'dusty-grape': '#586392ff',
      'lavender-grey': '#9da4beff',
      'thistle': '#b5afcfff',
    },
    palette2: {
      'night-bordeaux': '#68121fff',
      'midnight-violet': '#1f0d1eff',
      'midnight-violet-2': '#1e1333ff',
      'regal-navy': '#163275ff',
      'regal-navy-2': '#0b3c7cff',
      'baltic-blue': '#00639cff',
      'steel-azure': '#034e8cff',
      'dark-teal': '#153535ff',
      'stormy-teal': '#055f57ff',
      'emerald-depths': '#08583dff',
    },
    palette3: {
      'rosewood': '#bb265aff',
      'cherry-rose': '#ad2754ff',
      'rose-punch': '#c34f7fff',
      'soft-fawn': '#cdad62ff',
      'khaki-beige': '#c0b496ff',
      'cool-steel': '#98b7beff',
      'muted-teal': '#93bbb6ff',
      'amethyst-smoke': '#a78ebbff',
      'wisteria-blue': '#8ca0c1ff',
      'lilac': '#be98b4ff',
    },
  },

  // ========== ВЕСНА (нежная) ==========
  springGentle: {
    palette1: {
      'steel-azure': '#244ba0ff',
      'azure-blue': '#0a7bdeff',
      'pale-oak': '#d4c1b3ff',
      'chocolate': '#d76c2bff',
      'toasted-almond': '#d29560ff',
      'apricot-cream': '#e5c79aff',
      'powder-petal': '#ecdad1ff',
      'wheat': '#eed6a6ff',
      'wheat-2': '#eed8b2ff',
      'almond-cream': '#ebdcceff',
    },
    palette2: {
      'racing-red': '#e92d2dff',
      'light-coral': '#e17f7aff',
      'light-coral-2': '#e4918bff',
      'cotton-rose': '#ecbeb4ff',
      'tangerine-dream': '#ecaa8bff',
      'desert-sand': '#edc4afff',
      'jasmine': '#eed381ff',
      'moss-green': '#4cc25dff',
      'celadon': '#92cd98ff',
      'vanilla-custard': '#d7dda2ff',
    },
    palette3: {
      'strawberry-red': '#ea2f35ff',
      'bubblegum-pink': '#e26d80ff',
      'petal-rouge': '#dd7685ff',
      'cotton-rose': '#e5c0c0ff',
      'lavender-purple': '#906bbbff',
      'glaucous': '#768cc4ff',
      'ocean-twilight': '#4155b8ff',
      'ocean-mist': '#1bc5acff',
      'sky-blue-light': '#7bbed4ff',
      'sky-blue-light-2': '#5fc4dbff',
    },
  },
};