'use client'

import Link from 'next/link'

export default function Header() {
  return (
    <header className="w-full h-[60px] bg-white border-b border-[#f0f0f0] flex items-center justify-between px-5 sticky top-0 z-[100]">
      <div className="flex items-center gap-3">
        <Link href="/">
          <span className="font-serif italic text-[1.4rem] text-[#ff385c] font-bold">VENTSY</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button className="w-[38px] h-[38px] rounded-full bg-[#ff385c] text-white border-none cursor-pointer text-[1rem] font-bold flex items-center justify-center">
            ?
          </button>
        </div>
      </div>
    </header>
  )
}
