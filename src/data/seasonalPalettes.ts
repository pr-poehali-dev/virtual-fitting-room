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
}

export const seasonalPalettes: SeasonalPalettesData = {
  // ========== ЛЕТО (обычное) ==========
  summer: {
    palette1: {
      'slate-indigo': '#5065a4ff',
      'crimson-violet': '#591b44ff',
      'cherry-rose': '#af1845ff',
      'dark-raspberry': '#922455ff',
      'rosewood': '#ad4d72ff',
      'petal-pink': '#c185abff',
      'amethyst-smoke': '#a287b0ff',
      'bone': '#d0c8bbff',
      'thistle': '#d2b4beff',
      'powder-blue': '#b0bfcbff',
    },
    palette2: {
      'burgundy': '#6c171fff',
      'deep-crimson': '#971c20ff',
      'carmine': '#af283fff',
      'ruby-red': '#a11d2bff',
      'blush-rose': '#be6682ff',
      'old-rose': '#cb93abff',
      'powder-blue': '#98adc2ff',
      'teal': '#0a7d88ff',
      'pacific-cyan': '#2e909dff',
      'tropical-teal': '#6f9f9fff',
    },
    palette3: {
      'space-indigo': '#2a3150ff',
      'space-indigo-2': '#242c4bff',
      'dusk-blue': '#2a4972ff',
      'wisteria-blue': '#869dc5ff',
      'lavender-grey': '#999fbbff',
      'pale-slate': '#b3b2c2ff',
      'clay-soil': '#763e36ff',
      'smoky-rose': '#865e58ff',
      'silver': '#cfc5c3ff',
      'dust-grey': '#d8cfd1ff',
    },
  },

  // ========== ЛЕТО (яркое) ==========
  summerBright: {
    palette1: {
      'twilight-indigo': '#1b285fff',
      'space-indigo': '#182558ff',
      'steel-azure': '#1c4882ff',
      'wisteria-blue': '#7298d9ff',
      'wisteria-blue-2': '#8291d3ff',
      'soft-periwinkle': '#a19dd8ff',
      'chestnut': '#8a3124ff',
      'reddish-brown': '#a7483aff',
      'almond-silk': '#e0bab3ff',
      'pastel-petal': '#e6c2c9ff',
    },
    palette2: {
      'dark-wine': '#760f19ff',
      'deep-crimson': '#a11217ff',
      'carmine': '#bc1a35ff',
      'ruby-red': '#aa1322ff',
      'rose-punch': '#d44e79ff',
      'sweet-peony': '#de82aaff',
      'cool-horizon': '#83add8ff',
      'teal': '#07828dff',
      'pacific-blue': '#1e9daeff',
      'strong-cyan': '#4ec1c1ff',
    },
    palette3: {
      'royal-azure': '#3557c0ff',
      'crimson-violet': '#631248ff',
      'cherry-rose': '#b71042ff',
      'dark-raspberry': '#a01855ff',
      'hot-berry': '#c8326cff',
      'petal-pink': '#d76fb1ff',
      'lavender-purple': '#ac6bccff',
      'pale-oak': '#e0cba9ff',
      'pink-mist': '#e1a2b7ff',
      'powder-blue': '#9cc0ddff',
    },
  },

  // ========== ОСЕНЬ (обычная) ==========
  autumn: {
    palette1: {
      'mahogany-red': '#a71b1aff',
      'midnight-violet': '#341c3eff',
      'dark-wine': '#761d1eff',
      'brick-red': '#af4037ff',
      'red-ochre': '#c94722ff',
      'rusty-spice': '#c13d1eff',
      'ochre': '#c67313ff',
      'camel': '#ca985dff',
      'copperwood': '#b07311ff',
      'metallic-gold': '#d5af25ff',
    },
    palette2: {
      'mahogany-red': '#be191dff',
      'twilight-indigo': '#223367ff',
      'blue-spruce': '#0b685dff',
      'deep-space-blue': '#11364bff',
      'palm-leaf': '#909c3aff',
      'fern': '#577345ff',
      'evergreen': '#11281bff',
      'muted-teal': '#99a98eff',
      'olive-bark': '#695a2fff',
      'dark-coffee': '#3b2a1aff',
    },
    palette3: {
      'dark-wine': '#7c1913ff',
      'prussian-blue': '#112035ff',
      'taupe-grey': '#6c5f66ff',
      'dark-wine-2': '#7b1a13ff',
      'rich-mahogany': '#2e1010ff',
      'espresso': '#461e16ff',
      'deep-walnut': '#53331aff',
      'faded-copper': '#ad7e57ff',
      'khaki-beige': '#c2ad9bff',
      'silver': '#ccbfb9ff',
    },
  },

  // ========== ОСЕНЬ (яркая) ==========
  autumnBright: {
    palette1: {
      'blood-red': '#860f08ff',
      'prussian-blue': '#072040ff',
      'berry-blush': '#a4286aff',
      'blood-red-2': '#861108ff',
      'rich-mahogany': '#370707ff',
      'dark-garnet': '#531509ff',
      'dark-walnut': '#60300bff',
      'ochre': '#dc7928ff',
      'light-caramel': '#e5aa76ff',
      'peach-fuzz': '#eab39aff',
    },
    palette2: {
      'brick-ember': '#c61013ff',
      'imperial-blue': '#162e73ff',
      'blue-spruce': '#076e62ff',
      'deep-space-blue': '#0b3751ff',
      'lime-moss': '#a0b126ff',
      'forest-green': '#518b2dff',
      'evergreen': '#0b2d1aff',
      'willow-green': '#93c770ff',
      'olive-bark': '#7a621fff',
      'deep-walnut': '#462a11ff',
    },
    palette3: {
      'mahogany-red': '#b11111ff',
      'dark-amethyst': '#391249ff',
      'crushed-berry': '#811315ff',
      'flag-red': '#c22e24ff',
      'red-ochre': '#d43f16ff',
      'red-ochre-2': '#cd3614ff',
      'ochre': '#ce740dff',
      'golden-apricot': '#dd994bff',
      'copperwood': '#b6750bff',
      'metallic-gold': '#e2b618ff',
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
};
