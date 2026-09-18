export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}){
 const query=await searchParams;const path=query.next&&/^\/(dashboard|onboarding|profile)([/?]|$)/.test(query.next)&&!query.next.includes("\\")?query.next:"/dashboard";
 return <main className="authPage"><section className="authCard"><p className="eyebrow">CONNECTION INTERRUPTED</p><h1>We couldn’t check your session.</h1><p>The sign-in service couldn’t be reached or returned a temporary error. Your account and saved orders are unchanged.</p><a className="button" href={path}>Try again</a><p>If this continues, wait a moment and retry.</p><a href="/sign-in">Back to sign in</a></section></main>;
}
