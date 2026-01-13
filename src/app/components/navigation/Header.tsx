import React from 'react';

interface HeaderProps {
  date: string;
  title?: string;
  subtitle?: string;
}

export function Header({ date, title, subtitle }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
      <div className="text-xs text-gray-500 mb-1">{date}</div>
      {title && <h1 className="text-xl font-bold text-[#2d3561]">{title}</h1>}
      {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
    </header>
  );
}
