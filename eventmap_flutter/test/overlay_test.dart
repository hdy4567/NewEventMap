import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventmap_flutter/widgets/overlays.dart';

void main() {
  testWidgets('SearchBarOverlay UI Test', (WidgetTester tester) async {
    String? searchQuery;
    
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SearchBarOverlay(
          onSearch: (val) => searchQuery = val,
          isAiActive: false,
          onAiToggle: (val) {},
        ),
      ),
    ));

    // Check for the logo and hint text
    expect(find.text('N'), findsOneWidget);
    expect(find.textContaining('축제, 지역, @태그 검색'), findsOneWidget);

    // Test input
    await tester.enterText(find.byType(TextField), 'Seoul');
    expect(searchQuery, 'Seoul');

    // Check if clear button appears (Wait for rebuild if necessary)
    await tester.pump();
    expect(find.byIcon(Icons.close), findsOneWidget);

    // Test clear button
    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();
    expect(searchQuery, '');
    expect(find.byIcon(Icons.close), findsNothing);
  });
}
