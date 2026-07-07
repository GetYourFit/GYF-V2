import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/ai_stylist/presentation/screens/ai_stylist_screen.dart';
import '../../features/discover/presentation/screens/discover_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/wardrobe/presentation/screens/wardrobe_screen.dart';
import '../../shared/gallery/gallery_screen.dart';
import 'gyf_shell.dart';

/// Route paths (10_NAVIGATION_BIBLE). Tabs: Home, Discover, AI Stylist,
/// Wardrobe, Profile. Wishlist/Notifications/StyleDNA/Premium/Settings
/// are reachable within tabs and will be added as sub-routes.
abstract final class GyfRoutes {
  static const home = '/home';
  static const discover = '/discover';
  static const aiStylist = '/ai';
  static const wardrobe = '/wardrobe';
  static const profile = '/profile';
  static const gallery = '/gallery'; // internal component gallery
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: GyfRoutes.home,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => GyfShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: GyfRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: GyfRoutes.discover,
                builder: (context, state) => const DiscoverScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: GyfRoutes.aiStylist,
                builder: (context, state) => const AiStylistScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: GyfRoutes.wardrobe,
                builder: (context, state) => const WardrobeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: GyfRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: GyfRoutes.gallery,
        builder: (context, state) => const GalleryScreen(),
      ),
    ],
    // Deep links always validate and fall back gracefully.
    errorBuilder: (context, state) => const _RouteFallbackScreen(),
  );
});

class _RouteFallbackScreen extends StatelessWidget {
  const _RouteFallbackScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'We couldn’t open that link.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            TextButton(
              onPressed: () => context.go(GyfRoutes.home),
              child: const Text('Go to Home'),
            ),
          ],
        ),
      ),
    );
  }
}
