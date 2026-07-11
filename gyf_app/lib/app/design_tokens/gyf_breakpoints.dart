/// Responsive breakpoint tokens (02_DESIGN_SYSTEM / 07 Part H).
abstract final class GyfBreakpoints {
  static const double smallPhone = 360;
  static const double standardPhone = 480;
  static const double largePhone = 600;
  static const double tablet = 840;
  static const double largeTablet = 1200;
}

enum GyfDeviceClass {
  smallPhone,
  standardPhone,
  largePhone,
  tablet,
  largeTablet,
  desktop,
}

GyfDeviceClass deviceClassForWidth(double width) {
  if (width < GyfBreakpoints.smallPhone) return GyfDeviceClass.smallPhone;
  if (width < GyfBreakpoints.standardPhone) return GyfDeviceClass.standardPhone;
  if (width < GyfBreakpoints.largePhone) return GyfDeviceClass.largePhone;
  if (width < GyfBreakpoints.tablet) return GyfDeviceClass.tablet;
  if (width < GyfBreakpoints.largeTablet) return GyfDeviceClass.largeTablet;
  return GyfDeviceClass.desktop;
}

/// Icon size tokens — single family, outlined default, filled = active only.
abstract final class GyfIconSize {
  static const double xs = 16;
  static const double sm = 20;
  static const double md = 24;
  static const double lg = 32;
  static const double xl = 40;
  static const double xxl = 48;
}
