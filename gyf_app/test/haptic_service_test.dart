import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/design_tokens/design_tokens.dart';
import 'package:gyf_app/core/services/haptic_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<String> calls;
  late DateTime now;

  HapticService makeService() {
    calls = [];
    now = DateTime(2026);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'HapticFeedback.vibrate') {
            calls.add(call.arguments as String? ?? 'vibrate');
          }
          return null;
        });
    return HapticService(clock: () => now);
  }

  test('throttles events closer than the global min interval', () async {
    final service = makeService();
    await service.emit(GyfHaptic.light);
    now = now.add(const Duration(milliseconds: 50));
    await service.emit(GyfHaptic.light);
    expect(calls, hasLength(1));

    now = now.add(const Duration(milliseconds: 100));
    await service.emit(GyfHaptic.light);
    expect(calls, hasLength(2));
  });

  test('tab switches use the stricter 150 ms throttle', () async {
    final service = makeService();
    await service.emit(GyfHaptic.selection, isTabSwitch: true);
    now = now.add(const Duration(milliseconds: 120));
    await service.emit(GyfHaptic.selection, isTabSwitch: true);
    expect(calls, hasLength(1));
  });

  test('disabled level emits nothing', () async {
    final service = makeService()..level = GyfHapticLevel.disabled;
    await service.emit(GyfHaptic.success);
    expect(calls, isEmpty);
  });

  test('minimal level only lets status haptics through', () async {
    final service = makeService()..level = GyfHapticLevel.minimal;
    await service.emit(GyfHaptic.light);
    expect(calls, isEmpty);
    await service.emit(GyfHaptic.success);
    expect(calls, hasLength(1));
  });
}
