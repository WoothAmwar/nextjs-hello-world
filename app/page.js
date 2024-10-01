"use client"
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <p>Hello There Fellow API User</p>
      <div>
        <Link href="/random">
          About
        </Link>
      </div>
      <div>
        <Link href="/login">
          Login
        </Link>
      </div>
    </div>
  );
}
