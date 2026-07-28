// next.config.mjs
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
  ],
};

export default nextConfig;
