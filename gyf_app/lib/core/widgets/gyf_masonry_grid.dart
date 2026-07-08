import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';

/// One masonry entry. [aspectRatio] (width / height) only drives the
/// column bin-packing heuristic below — [child] sizes itself.
class GyfMasonryItem {
  const GyfMasonryItem({required this.aspectRatio, required this.child});

  final double aspectRatio;
  final Widget child;
}

/// Pinterest-style two-(or more)-column masonry (Ref3/Ref4 explore
/// language): each new item goes into whichever column is currently
/// shortest, so uneven tile heights interleave instead of leaving gaps.
class GyfMasonryGrid extends StatelessWidget {
  const GyfMasonryGrid({
    required this.items,
    this.columns = 2,
    this.spacing = GyfSpacing.s8,
    super.key,
  });

  final List<GyfMasonryItem> items;
  final int columns;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final columnChildren = List.generate(columns, (_) => <Widget>[]);
    final columnHeights = List.filled(columns, 0.0);

    for (final item in items) {
      var shortest = 0;
      for (var i = 1; i < columns; i++) {
        if (columnHeights[i] < columnHeights[shortest]) shortest = i;
      }
      if (columnChildren[shortest].isNotEmpty) {
        columnChildren[shortest].add(SizedBox(height: spacing));
      }
      columnChildren[shortest].add(item.child);
      columnHeights[shortest] += 1 / item.aspectRatio;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var c = 0; c < columns; c++) ...[
          if (c > 0) SizedBox(width: spacing),
          Expanded(child: Column(children: columnChildren[c])),
        ],
      ],
    );
  }
}
