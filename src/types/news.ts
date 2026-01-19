/**
 * ニュースの型定義
 */

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  link: string;
  pubDate: string;
  description?: string;
  content?: string;
  categories?: string[];
}

export interface NewsSource {
  name: string;
  url: string;
  enabled: boolean;
}
