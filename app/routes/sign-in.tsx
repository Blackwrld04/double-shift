import { useEffect } from "react";

/**
 * When client-side routing navigates to /sign-in, this route triggers a full document
 * request so Nitro serves the branded Double Shift Welcome & Sign-In surface.
 */
export default function SignInRoute() {
  useEffect(() => {
    window.location.replace("/sign-in");
  }, []);

  return null;
}

