"use client";

import { useEffect, useState } from "react";
import { responseJson } from "../../lib/api-client";
import { restaurantValidationError } from "../../lib/restaurant-validation";
import "../pages.css";

const steps = ["The basics", "Your menu", "Ready to launch"];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
    .replace(/-$/, "");

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("plated:onboarding") || "null",
      );
      if (
        draft &&
        [
          draft.name,
          draft.slug,
          draft.description,
          draft.pickupAddress,
          draft.contactPhone,
          draft.dishName,
          draft.dishPrice,
        ].every((value) => typeof value === "string")
      ) {
        setName(draft.name);
        setSlug(draft.slug);
        setDescription(draft.description);
        setPickupAddress(draft.pickupAddress);
        setContactPhone(draft.contactPhone);
        setDishName(draft.dishName);
        setDishPrice(draft.dishPrice);
      }
    } catch {
      /* The form remains usable if browser storage is unavailable. */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        "plated:onboarding",
        JSON.stringify({
          name,
          slug,
          description,
          pickupAddress,
          contactPhone,
          dishName,
          dishPrice,
        }),
      );
    } catch {}
  }, [
    restored,
    name,
    slug,
    description,
    pickupAddress,
    contactPhone,
    dishName,
    dishPrice,
  ]);

  async function next() {
    if (saving) return;
    setError("");
    const validation = restaurantValidationError(
      {
        name,
        slug,
        description,
        dishName,
        dishPrice: Number(dishPrice),
        pickupAddress,
        contactPhone,
      },
      step === 2 ? undefined : step,
    );
    if (validation) {
      setError(validation.message);
      setStep(validation.step);
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          dishName,
          dishPrice: Number(dishPrice),
          pickupAddress,
          contactPhone,
        }),
      });
      const result = await responseJson<{ restaurant?: { id?: string } }>(
        response,
      );
      if (!result.restaurant?.id)
        throw new Error(
          "The restaurant launch was not confirmed. Please retry.",
        );
      try {
        sessionStorage.removeItem("plated:onboarding");
      } catch {}
      location.assign("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Connection failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboardingPage">
      <section>
        <aside>
          <p className="eyebrow">RESTAURANT LAUNCHPAD</p>
          <h1>Let’s put your place on the map.</h1>
          <p>Create your ordering site with your own brand and first dish.</p>
          <ol>
            {steps.map((label, index) => (
              <li
                className={
                  index === step ? "active" : index < step ? "done" : ""
                }
                key={label}
                aria-current={index === step ? "step" : undefined}
              >
                <b>0{index + 1}</b>
                {label}
              </li>
            ))}
          </ol>
        </aside>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void next();
          }}
        >
          <p className="eyebrow">
            STEP {step + 1} OF {steps.length}
          </p>
          <div className="stepMeter">
            <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          {step === 0 && (
            <>
              <h2>Tell us about your place</h2>
              <label>
                Restaurant name
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!slug || slug === slugify(name))
                      setSlug(slugify(value));
                    setName(value);
                  }}
                />
              </label>
              <label>
                Storefront address
                <input
                  required
                  maxLength={80}
                  pattern="[a-z0-9]+([-_][a-z0-9]+)*"
                  value={slug}
                  onChange={(event) =>
                    setSlug(event.target.value.toLowerCase())
                  }
                  aria-describedby="slug-help"
                />
              </label>
              <small id="slug-help">
                Your site will be at /r/{slug || "your-restaurant"}. Use
                letters, numbers, and single hyphens or underscores.
              </small>
              <label>
                About your restaurant
                <textarea
                  required
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                Pickup address
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={pickupAddress}
                  onChange={(event) => setPickupAddress(event.target.value)}
                />
              </label>
              <label>
                Restaurant phone
                <input
                  required
                  type="tel"
                  maxLength={25}
                  aria-describedby="phone-help"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </label>
              <small id="phone-help">
                Use 7–15 digits, optionally with a country code such as +91.
                Letters are not allowed.
              </small>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Add your first dish.</h2>
              <label>
                Dish name
                <input
                  required
                  maxLength={100}
                  value={dishName}
                  onChange={(event) => setDishName(event.target.value)}
                />
              </label>
              <label>
                Price (₹)
                <input
                  required
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={dishPrice}
                  onChange={(event) => setDishPrice(event.target.value)}
                />
              </label>
            </>
          )}
          {step === 2 && (
            <div className="launchStep">
              <span>✦</span>
              <h2>{name} is ready for its close-up.</h2>
              <p>{description}</p>
              <p>
                {dishName} · ₹ {dishPrice}
              </p>
              <p>
                Pickup from {pickupAddress} · {contactPhone}
              </p>
              <p>
                Your storefront will be published at /r/{slug}. You can enable
                delivery in Settings.
              </p>
            </div>
          )}
          {error && (
            <p className="authError" role="alert">
              {error}
            </p>
          )}
          <div className="onboardActions">
            <span />
            {step > 0 && (
              <button
                type="button"
                className="textButton"
                disabled={saving}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                ← Back
              </button>
            )}
            <button className="button" disabled={saving || !restored}>
              {saving
                ? "Creating…"
                : step === 2
                  ? "Launch my restaurant →"
                  : "Continue →"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
