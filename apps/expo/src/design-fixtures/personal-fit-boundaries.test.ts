import { describe, expect, test } from "bun:test";

const formSource = await Bun.file(
  new URL("../components/onboarding/personal-fit-form.tsx", import.meta.url),
).text();
const onboardingFormSource = await Bun.file(
  new URL("../components/onboarding/onboarding-form.tsx", import.meta.url),
).text();
const onboardingRouteSource = await Bun.file(
  new URL("../app/(app)/onboarding.tsx", import.meta.url),
).text();
const personalFitRouteSource = await Bun.file(
  new URL("../app/(app)/personal-fit.tsx", import.meta.url),
).text();

describe("Personal Fit Setup boundaries", () => {
  test("exports a shared create/edit form component", () => {
    expect(formSource).toContain("export function PersonalFitForm");
    expect(formSource).toMatch(/mode:\s*["']create["']\s*\|\s*["']edit["']/);
  });

  test("the photo action is accessible and explicitly optional", () => {
    const photoSection = formSource.slice(
      formSource.indexOf("Add a photo"),
      formSource.indexOf("Skin tone"),
    );
    expect(photoSection).not.toBe("");
    expect(photoSection).toMatch(/optional/i);
    expect(photoSection).toContain("accessibilityLabel");
    expect(photoSection).toContain("AtelierButton");
  });

  test("skin tone and body type render as canonical dropdowns", () => {
    expect(formSource).toContain("SKIN_TONE_OPTIONS.map");
    expect(formSource).toContain("BODY_TYPE_OPTIONS.map");
    expect(formSource).toContain('label: "Rectangle');
    expect(formSource).toContain("mst${n}");
  });

  test("currency and min/max budget fields are present", () => {
    expect(formSource).toContain("CURRENCIES.map");
    expect(formSource).toContain("Minimum price per garment");
    expect(formSource).toContain("Maximum price per garment");
  });

  test("estimates stay visibly distinct from confirmed values", () => {
    expect(formSource).toContain("<ConfidenceLabel");
    expect(formSource).toContain('source === "photo"');
    expect(formSource).toContain("!fields.skin_tone.confirmed");
  });

  test("every analysis state has honest, distinct messaging", () => {
    expect(formSource).toContain("consent_required");
    expect(formSource).toMatch(/Allow GYF to store your photo/);
    expect(formSource).toMatch(/Uploading and analysing/);
    expect(formSource).toMatch(/Photo estimate removed/);
    expect(formSource).not.toMatch(/Analysis (complete|succeeded)!/i);
  });

  test("photo action and save action guard against duplicate submits", () => {
    expect(formSource).toMatch(/if\s*\(photoBusy\)\s*return;/);
    expect(formSource).toMatch(/disabled=\{saving \|\| photoBusy\}/);
  });

  test("create and edit modes are distinguishable, and only edit offers a way back", () => {
    // Create is the required post-signup step and is reached with nothing behind
    // it; edit is pushed from Profile. The headers differ accordingly — a back
    // control on the create step would strand a half-onboarded user.
    expect(formSource).toContain("Set up your personal fit");
    expect(formSource).toMatch(
      /mode === "edit" \?[\s\S]{0,120}SubScreenHeader title="Personal fit"/,
    );
    expect(formSource).toContain('"Save personal fit"');
    expect(formSource).toContain('"Save changes"');
  });

  test("edit mode loads existing values without rerunning analysis on mount", () => {
    expect(formSource).toContain("api.getProfile()");
    expect(formSource).not.toMatch(/useEffect\([^)]*uploadProfilePhoto/s);
  });

  test("the onboarding route completes profile then personal fit before Stylist", () => {
    expect(onboardingRouteSource).toContain("OnboardingForm");
    expect(onboardingRouteSource).toContain('mode="create"');
    expect(onboardingRouteSource).toContain("PersonalFitForm");
  });

  test("the profile edit route opens personal fit in edit mode", () => {
    expect(personalFitRouteSource).toContain('mode="edit"');
    expect(personalFitRouteSource).toContain("PersonalFitForm");
  });

  test("onboarding-form hands off to its caller instead of navigating itself", () => {
    expect(onboardingFormSource).toContain("onSaved");
    expect(onboardingFormSource).toContain("export function OptionChip");
  });
});
