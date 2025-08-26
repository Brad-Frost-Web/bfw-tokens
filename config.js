import StyleDictionary from 'style-dictionary';
import minimist from 'minimist';

/**
 * List of themes to build
 * 1) Add your new theme here in order to have it show up in the dropdown
 */
const AVAILABLE_THEMES = ['bfw', 'bfw-dark', 'wowee-zowee', 'something-else'];

/**
 * Look for args passed on the command line
 * 1) Used to build a single theme if needed
 * 2) Pass in the theme name as an argument
 * 3) If no argument is passed, build all themes
 */
const args = minimist(process.argv.slice(2));
const theme = args.theme;

/**
 * Helper function to check if token is from tier-2 or tier-3
 * 1) Used to determine if the token should be included in the theme tokens to apply `theme` prefix
 */
const isHigherTierToken = (filePath) => {
  const isHigherTier = filePath.includes('tier-2-usage') || filePath.includes('tier-3-components');
  return isHigherTier;
};

/**
 * Transform shadow tokens
 * 1) Used to transform the individual shadow tokens into a single box-shadow-sm, box-shadow-md, etc. with x, y, blur, spread, and color concatenated
 */
const transformShadowTokens = (dictionary, size, themeTokens) => {
  const shadowProps = dictionary.allTokens.filter((p) => isHigherTierToken(p.filePath) && p.path[0] === 'box-shadow' && p.path[1] === size);

  const x = shadowProps.find((p) => p.path[2] === 'x')?.value || '0px';
  const y = shadowProps.find((p) => p.path[2] === 'y')?.value || '0px';
  const blur = shadowProps.find((p) => p.path[2] === 'blur')?.value || '0px';
  const spread = shadowProps.find((p) => p.path[2] === 'spread')?.value || '0px';
  const color = shadowProps.find((p) => p.path[2] === 'color')?.value || 'transparent';

  /* 1 */
  themeTokens.push(`  --bf-theme-box-shadow-${size}: ${x} ${y} ${blur} ${spread} ${color};`);
};

/**
 * Transform line height tokens
 * 1) Used to transform the line height tokens to a unitless value for CSS by dividing the line height by the font size
 */
const transformLineHeight = (dictionary, prop, themeTokens) => {
  const cleanPath = prop.path
    .map((segment) => (segment.startsWith('@') ? segment.substring(1) : segment))
    .filter((segment) => segment !== '')
    .join('-');

  const fontSizePath = [...prop.path.slice(0, -1), 'font-size'];
  const fontSizeProp = dictionary.allTokens.find((p) => p.path.join('.') === fontSizePath.join('.'));

  if (fontSizeProp) {
    const lineHeightPx = parseFloat(prop.value.replace('rem', '')) * 16;
    const fontSizePx = parseFloat(fontSizeProp.value.replace('rem', '')) * 16;
    const unitlessValue = (lineHeightPx / fontSizePx).toFixed(2);
    themeTokens.push(`  --bf-theme-${cleanPath}: ${unitlessValue};`);
  } else {
    themeTokens.push(`  --bf-theme-${cleanPath}: ${prop.value};`);
  }
};

/**
 * Format variables
 * 1) Used to format the inner contents of the :root or .[theme-name] ruleset
 */
const formatVariables = (dictionary) => {
  const processedShadows = new Set();
  const tier1Tokens = [];
  const themeTokens = [];

  /**
   * Format token global prefix and tier 2/3 identifier
   * 1) If the token is from tier-2 or tier-3, prefix it with `bf-theme-`
   * 2) Otherwise, prefix it with `bf-`
   */
  const formatTokenName = (cleanPath, prop) => {
    if (isHigherTierToken(prop.filePath)) {
      return `--bf-theme-${cleanPath}`;
    }
    return `--bf-${cleanPath}`;
  };

  /**
   * Get all box-shadow values from tier 2/3
   * 1) Used to determine which box-shadow values to transform into a single box-shadow-sm, box-shadow-md, etc.
   */
  const shadowSizes = Object.keys(dictionary.tokens.shadow)
    .map((key) => key.split('-')[0])
    .filter((value, index, self) => self.indexOf(value) === index); // Get unique sizes

  /**
   * Iterate over all tokens and format them
   *
   */
  dictionary.allTokens.forEach((prop) => {
    /**
     * 1) Always include z-index and size tokens from core
     */
    if (prop.path[0] === 'z-index') {
      const cleanPath = prop.path
        .map((segment) => (segment.startsWith('@') ? segment.substring(1) : segment))
        .filter((segment) => segment !== '')
        .join('-');
      tier1Tokens.push(`  ${formatTokenName(cleanPath, prop)}: ${prop.value};`);
      return;
    }

    /**
     * Handle box-shadow token transformations
     * If the token is from tier-2 or tier-3 and is a box-shadow, transform it into a single box-shadow-sm, box-shadow-md, etc.
     */
    if (isHigherTierToken(prop.filePath) && prop.path[0] === 'box-shadow' && shadowSizes.includes(prop.path[1])) {
      const size = prop.path[1];
      if (processedShadows.has(size)) return;
      processedShadows.add(size);
      transformShadowTokens(dictionary, size, themeTokens);
    } else if (isHigherTierToken(prop.filePath) && prop.path[0] === 'typography' && prop.path.includes('line-height')) {
      /**
       * Handle line heights in theme typography
       * 1) If the token is from tier-2 or tier-3 and is a typography token with a line-height, transform it to a unitless value
       */
      transformLineHeight(dictionary, prop, themeTokens);
    } else if (!prop.path.includes('box-shadow') || prop.path.length > 3) {
      /**
       * Handle all other properties
       * 1) If the token is not a box-shadow or typography token, format it as a normal token
       */
      const cleanPath = prop.path
        .map((segment) => (segment.startsWith('@') ? segment.substring(1) : segment))
        .filter((segment) => segment !== '')
        .join('-');

      const token = `  ${formatTokenName(cleanPath, prop)}: ${prop.value};`;
      if (isHigherTierToken(prop.filePath)) {
        themeTokens.push(token);
      } else {
        tier1Tokens.push(token);
      }
    }
  });

  return [...new Set([...tier1Tokens, ...themeTokens])].join('\n');
};

/**
 * Transform shadow tokens for JSON format
 * Combines individual shadow properties into a single value
 */
const transformShadowTokensJSON = (dictionary, size) => {
  const shadowProps = dictionary.allTokens.filter((p) => isHigherTierToken(p.filePath) && p.path[0] === 'box-shadow' && p.path[1] === size);

  const x = shadowProps.find((p) => p.path[2] === 'x')?.value || '0px';
  const y = shadowProps.find((p) => p.path[2] === 'y')?.value || '0px';
  const blur = shadowProps.find((p) => p.path[2] === 'blur')?.value || '0px';
  const spread = shadowProps.find((p) => p.path[2] === 'spread')?.value || '0px';
  const color = shadowProps.find((p) => p.path[2] === 'color')?.value || 'transparent';

  return `${x} ${y} ${blur} ${spread} ${color}`;
};

/**
 * Generate a Theme-Specific Config
 * This accepts a theme parameter, which is used to control which set of
 * tokens to compile, and to define theme-specific compiled output.
 * @param {string} theme
 */
const getStyleDictionaryConfig = (theme) => {
  // Register the JSON formatter
  StyleDictionary.registerFormat({
    name: 'json/flat/custom',
    format: function (dictionary) {
      const transformedTokens = {};

      /**
       * Get all box-shadow values from tier 2/3
       * 1) Used to determine which box-shadow values to transform into a single box-shadow-sm, box-shadow-md, etc.
       */
      const shadowSizes = Object.keys(dictionary.tokens.shadow)
        .map((key) => key.split('-')[0])
        .filter((value, index, self) => self.indexOf(value) === index); // Get unique sizes

      // Process regular tokens
      dictionary.allTokens.forEach((token) => {
        // Remove the isHigherTierToken check to include all tokens
        if (token.path[0] === 'box-shadow' && token.path.length > 2) return;
        const prefix = isHigherTierToken(token.filePath) ? 'bf-theme-' : 'bf-';
        transformedTokens[`${prefix}${token.path.join('-')}`] = token.value;
      });

      // Process shadow tokens
      shadowSizes.forEach((size) => {
        transformedTokens[`bf-theme-box-shadow-${size}`] = transformShadowTokensJSON(dictionary, size);
      });

      return JSON.stringify(transformedTokens, null, 2);
    }
  });

  /**
   * Register the CSS formatter
   * 1) Used to format the inner contents of the .[theme-name] ruleset for Storybook only or if you want to define tokens using a theme name
   */
  StyleDictionary.registerFormat({
    name: 'css/variables-themed',
    format: function (dictionary) {
      return `.${theme} {\n${formatVariables(dictionary)}\n}\n`;
    }
  });

  /**
   * Define the base pixel value for rem conversion
   */
  const BASE_FONT_SIZE = 16; // Typically 16px = 1rem

  /**
   * Register the size/px-to-rem transform
   * 1) Used to convert px values to rem values
   * 2) Match only properties with px values
   * 3) Only transform if it's a valid px value
   */
  StyleDictionary.registerTransform({
    name: 'size/px-to-rem',
    type: 'value',
    matcher: function (prop) {
      /* 2 */
      return prop && prop.value && typeof prop.value === 'string' && prop.value.endsWith('px');
    },
    transform: function (prop) {
      if (!prop || !prop.value) return prop.value;
      /* 3 */
      const pxValue = prop.value.trim();
      if (!pxValue.endsWith('px')) return prop.value;

      const pixels = parseFloat(pxValue);
      if (isNaN(pixels)) return prop.value;

      const remValue = Number((pixels / BASE_FONT_SIZE).toFixed(4)).toString();
      return `${remValue}rem`;
    }
  });

  /**
   * Register the CSS formatter
   * 1) Used to format the inner contents of the :root ruleset for Storybook only or if you want to define tokens with theme prefix
   */
  StyleDictionary.registerFormat({
    name: 'css/custom-variables',
    format: function (dictionary) {
      return `:root {\n${formatVariables(dictionary)}\n}`;
    }
  });

  /**
   * Register the name/theme-prefix transform
   * 1) Used to prefix the token name with the theme name
   * 2) If the token is from tier-2 or tier-3, prefix it with `BfTheme` for JS
   * 3) Otherwise, prefix it with `Bf` for JS
   */
  StyleDictionary.registerTransform({
    name: 'name/theme-prefix',
    type: 'name',
    transform: function (token) {
      const cleanPath = token.path
        .map((segment) => (segment.startsWith('@') ? segment.substring(1) : segment))
        .filter((segment) => segment !== '')
        .join('-');

      /* 2 */
      if (isHigherTierToken(token.filePath)) {
        return `BfTheme${cleanPath
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('')}`;
      }

      /* 3 */
      return `Bf${cleanPath
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`;
    }
  });

  /**
   * Register the custom/css transform group
   */
  StyleDictionary.registerTransformGroup({
    name: 'custom/css',
    transforms: ['attribute/cti', 'name/kebab', 'size/px-to-rem']
  });

  /**
   * Register the custom/js transform group
   */
  StyleDictionary.registerTransformGroup({
    name: 'custom/js',
    transforms: ['attribute/cti', 'name/theme-prefix', 'size/px-to-rem']
  });

  /**
   * Define the config
   * 1) Used to define the platforms, prefixes, etc. to build the tokens with/for
   */
  const config = {
    source: [`./tokens/core/**/*.json`, `./tokens/${theme}/**/*.json`],
    log: {
      // Set the log level to show errors, warnings, and info messages
      verbosity: 'verbose'
    },
    platforms: {
      ts: {
        transformGroup: 'custom/js',
        prefix: 'Bf',
        buildPath: './',
        filter: {
          attributes: {
            category: 'theme'
          }
        },
        files: [
          {
            destination: `./tokens/${theme}/build/js/tokens.js`,
            format: 'javascript/es6'
          },
          {
            destination: `./tokens/${theme}/build/js/tokens.d.ts`,
            format: 'typescript/es6-declarations'
          }
        ]
      },
      css: {
        transformGroup: 'custom/css',
        prefix: 'bf',
        buildPath: './',
        filter: {
          attributes: {
            category: 'theme'
          }
        },
        files: [
          {
            destination: `./tokens/${theme}/build/css/tokens.css`,
            format: 'css/custom-variables'
          },
          {
            destination: `./tokens/${theme}/build/css/${theme}.css`,
            format: 'css/variables-themed'
          }
        ]
      },
      json: {
        transformGroup: 'custom/css',
        prefix: 'bf',
        buildPath: './',
        filter: {
          attributes: {
            category: 'theme'
          }
        },
        files: [
          {
            destination: `./tokens/${theme}/build/json/tokens.json`,
            format: 'json/flat/custom'
          }
        ]
      }
    }
  };

  return config;
};

/**
 * Build the tokens
 * 1) If no theme is specified, build all themes
 * 2) Otherwise, build the specified theme
 */
if (!theme) {
  console.log('🚧 No theme specified, building all themes...');
  AVAILABLE_THEMES.forEach((themeName) => {
    console.log(`\n🏗️ Building ${themeName.toUpperCase()} theme`);
    const themeConfig = getStyleDictionaryConfig(themeName);
    const StyleDictionaryExtended = new StyleDictionary(themeConfig);
    StyleDictionaryExtended.buildAllPlatforms();
  });
} else {
  console.log(`🚧 Building ${theme.toUpperCase()} theme`);
  const config = getStyleDictionaryConfig(theme);
  const StyleDictionaryExtended = new StyleDictionary(config);
  StyleDictionaryExtended.buildAllPlatforms();
}
