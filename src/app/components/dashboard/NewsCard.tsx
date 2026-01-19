import React from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import type { NewsItem } from '../../types/news';

interface NewsCardProps {
  news: NewsItem[];
  onViewAll: () => void;
}

export function NewsCard({ news, onViewAll }: NewsCardProps) {
  const topNews = news.slice(0, 3);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#2d3561]">トライアスロンニュース</h2>
        <button 
          onClick={onViewAll}
          className="text-xs text-[#6666FF] hover:text-[#5555EE] font-medium"
        >
          すべて見る
        </button>
      </div>

      <div className="space-y-2.5">
        {topNews.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Newspaper className="w-4 h-4 text-[#6666FF] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-[#6666FF] transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.source}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
