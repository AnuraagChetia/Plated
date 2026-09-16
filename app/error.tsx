"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="authPage"><section className="authCard"><h1>We couldn’t load this page.</h1>
    <p>Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button>
    <p><a href="/">Back to home</a></p></section></main>;
}
