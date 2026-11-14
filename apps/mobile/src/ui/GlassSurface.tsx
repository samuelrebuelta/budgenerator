import { StyleSheet, View, type ColorValue, type ViewProps } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { colors } from '@bg/ui-tokens';
import { useNativeLook } from './platform';

export interface GlassSurfaceProps extends ViewProps {
  /** Glass tint (a «prominent» glass, like the system's `.glassProminent`). */
  tint?: ColorValue;
  /** Glass that reacts to touch (scale and shine); only for controls. Fixed on mount. */
  interactive?: boolean;
  /** Solid colour used when there is no Liquid Glass (iOS < 26, Reduce Transparency, Android). */
  fallbackColor?: ColorValue;
}

/**
 * Floating surface of the navigation layer (toasts, floating buttons): Liquid Glass on iOS 26 and
 * a solid surface with a hairline border elsewhere. Content (cards, lists) never goes on glass.
 * The glass is always light (`colorScheme="light"`): the app has no dark mode in v1.
 * Do not animate the opacity of this view or its parents: UIKit stops drawing the glass.
 */
export function GlassSurface({
  tint,
  interactive = false,
  fallbackColor = colors.surface,
  style,
  children,
  ...props
}: GlassSurfaceProps) {
  const look = useNativeLook();
  if (look === 'glass')
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="light"
        tintColor={tint}
        isInteractive={interactive}
        style={style}
        {...props}
      >
        {children}
      </GlassView>
    );
  return (
    <View
      style={[
        styles.solid,
        { backgroundColor: fallbackColor },
        look === 'ios' && styles.ios,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  solid: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors['line-strong'] },
  ios: { borderCurve: 'continuous' },
});
