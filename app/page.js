"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";
import styled, { keyframes } from "styled-components";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Hero>
      <FormWrapper>
        <form
          onSubmit={handleLogin}
          className="bg-black/60 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-sm"
        >
          {error && (
            <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-500 bg-black/40 text-white rounded px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-500 bg-black/40 text-white rounded px-3 py-2 mb-5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />

          <GlitchButton type="submit">Login</GlitchButton>
        </form>
      </FormWrapper>
    </Hero>
  );
}

/* ----- styles ----- */
const Hero = styled.div`
  height: 100vh;
  display: flex;
  align-items: flex-end; /* zet form onderaan */
  justify-content: center;
  background: url("/flawless-logo.png") no-repeat center center;
  background-size: cover;
  position: relative;
`;

const FormWrapper = styled.div`
  margin-bottom: 3rem; /* afstand van onderkant */
`;

const glitch = keyframes`
  0% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  20% { text-shadow: -2px 0 #0ea5e9, 2px 0 #ff0080; }
  40% { text-shadow: 2px 0 #ff0080, -2px 0 #0ea5e9; }
  60% { text-shadow: -2px 0 #ff0080, 2px 0 #0ea5e9; }
  80% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  100% { text-shadow: none; }
`;

const GlitchButton = styled.button`
  width: 100%;
  padding: 1rem 2.5rem;
  border: 2px solid #0ea5e9;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 1px;
  text-decoration: none;
  position: relative;
  box-shadow:
    0 0 12px rgba(14, 165, 233, 0.6),
    0 0 6px rgba(255, 0, 128, 0.5);
  transition: all 0.25s ease;

  &:hover {
    animation: ${glitch} 0.6s infinite;
    border-color: #ff0080;
    box-shadow:
      0 0 16px rgba(255, 0, 128, 0.8),
      0 0 8px rgba(14, 165, 233, 0.8);
    transform: scale(1.05);
  }
`;
