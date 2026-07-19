# GYF design-language owner input

> **Status:** retained owner-input evidence. Its durable intent has been folded into
> [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) and mapped through
> [`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) to
> [`docs/plans/gyf-launch-refactor-plan.md`](./docs/plans/gyf-launch-refactor-plan.md). This file is
> non-executable, cannot reorder the active contract or promote a gate, and remains until protected
> F13 retention/deletion review.

using the reference images , apply the design languange globally on the app.

use Expo Ui skills , gluestack and all relevant design and development skills reqiored for the design , animation and smooth functioning of the app.

The font usage on all pages should be symmetric i.e The font used for headings must be same for all pages , the font used for subheadings or other content info should be different from the heading.

This build should be done in scope of Expo as the app is on Expo https://get-your-fit.expo.app/welcome .

Use all relevant skills and references as this app is being built to be shipped and it will be used by the people worldwide, hence the design and UI/UX should be top of the line.

The Grid on explore page , change its svg and use the svg similar to the ref3 image on the top left and animate that svg. The svg should be inside the search bar on the explore page and the search bar should be of a pill design with liquid glass texture.

Adjust the filters on that page by making another Svg of high quality , when clicked shows all the filters in a dropdown way pill box or curved end box.

The profile page should consist a profile pic add option which when added can be used as svg on the bottom nav for profile. The profile page should be organised and well informed keeping it clean and optimised.

The additional parts like menu , settings etc should be adjusted on the respective pages using high quality svg and opening animations , also keep an option of light theme and dark theme in the menu.

The expandable gid is like an infinite grid , use ref1 and ref2 for the grid design and build.

Use ref4 image for showcasing the portfolio on explore and stylist page , keep the frames such that the whole article is visible and with sharp edges, boxy tone.

Apply liquid glass design wherever you feel it looks top of the line.

Modify and make the wadrobe page also more beautifull and organised.

The app should be organised , each button placing should have a meaning and convinience of use.

Optimise this app as it will be launched for IOS and Android mobiles , hence fetch all the dimension of the phones used in these 2 OS and optimise the screen sizing , font sizing etc accordingly.

Act as a Principal React Native and Expo Engineer. Optimize the following code for maximum performance (targeting a consistent 60/120 FPS) and add micro-interactions using native haptics. Apply these exact architectural rules:

1. LIST VIRTUALIZATION: Replace any Standard 'FlatList' or 'ScrollView' containing dynamic data with Shopify's 'FlashList'. Provide an estimatedItemSize and ensure no anonymous functions are defined inside renderItem.
2. UI THREAD ANIMATIONS: Convert all layouts, transitions, or gesture animations to 'react-native-reanimated' (v3+) and 'react-native-gesture-handler'. All style updates must run strictly on the UI thread using useAnimatedStyle.
3. IMAGE CACHING: Replace standard 'Image' components with 'expo-image'. Configure them with priority="high", cachePolicy="disk", and a smooth fade-in transition effect.
4. RENDER OPTIMIZATION: Prevent unnecessary re-renders. Use React.memo() for list items, memoize callbacks with useCallback, and ensure the code structure is fully compatible with the React Compiler.
5. EXPO HAPTICS INTEGRATION: Integrate 'expo-haptics' to provide tactical feedback for user actions. Use:
   - Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) for standard button taps, keyboard key presses, or subtle toggles.
   - Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) for primary actions like submitting a form, checking a checkbox, or liking an item.
   - Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) for successful asynchronous operations (e.g., payment complete, item saved).
   - Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) for validation failures or API errors.


(im just telling you for telling sake about my personal machine so that less tokens will be spent 
  "You are working on macOS.
 
  Environment:
  - Shell: zsh
  - Editor: VS Code
  - Terminal: Apple Terminal
  - Multiplexer: tmux
  - GitHub CLI: gh
  - Apple Containers (not Docker Desktop)
 
  Available tools:
  - rg (ripgrep): search text instead of reading entire directories.
  - fd: locate files instead of using find.
  - eza: list files/directories.
  - bat: preview files with syntax highlighting.
  - jq: parse JSON instead of manual parsing.
  - yazi: terminal file manager (only mention if interactive browsing is useful).
  - lazygit: interactive Git UI (prefer normal git commands unless I ask).
  - zoxide: directory jumping (use z/zi when giving navigation examples).
  - atuin: searchable shell history.
  - tmux: use persistent sessions for long-running tasks.
  - http (HTTPie): preferred over curl for manual API exploration.
  - wget: preferred for downloading files.
 
  Guidelines:
  - Never recursively read an entire repository unless explicitly requested.
  - Prefer rg to locate symbols, TODOs, imports, functions, or text.
  - Prefer fd to locate files.
  - Read only the minimum files necessary.
  - When inspecting code, suggest targeted rg searches first.
  - Keep terminal output concise.
  - Avoid commands that generate excessive output.
  - Prefer incremental investigation over exhaustive scanning.
  - Use jq whenever JSON needs filtering or formatting.
  - Assume modern Git, Homebrew, and Apple Silicon.
  - When a task may take a long time, recommend running it inside tmux.
  - Favor commands that minimize context and token usage.")