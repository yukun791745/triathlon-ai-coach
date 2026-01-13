import React from 'react';
import { LucideIcon } from 'lucide-react';

interface NavTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-[#6666FF]' : 'text-gray-400'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
