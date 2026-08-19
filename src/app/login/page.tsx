import LoginForm from "./LoginForm";

/**
 * Måste renderas per request.
 *
 * CSP:ns nonce sätts vid rendering. En statiskt prerenderad sida får ingen —
 * och då blockerar strict-dynamic samtliga script, så inloggningen slutar
 * fungera helt. Alla andra sidor är dynamiska av sig själva eftersom de
 * anropar auth(); den här gör det inte, och behöver därför sägas till.
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
