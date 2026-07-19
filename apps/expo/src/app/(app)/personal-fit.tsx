import { router } from "expo-router";

import { PersonalFitForm } from "@/components/onboarding/personal-fit-form";

/** Profile's "Edit personal fit" entry point — the same form as onboarding, in edit
 *  mode, loaded with the user's current confirmed values. */
export default function PersonalFitRoute() {
  return (
    <PersonalFitForm
      mode="edit"
      onSaved={() => (router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/profile"))}
    />
  );
}
