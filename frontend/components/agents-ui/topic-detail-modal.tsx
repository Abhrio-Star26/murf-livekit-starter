'use client';

import React, { useState } from 'react';
import {
  Bank,
  ShieldCheck,
  Sparkle,
  X,
  MagnifyingGlass,
  ArrowUpRight,
  Phone,
  WarningOctagon,
  CheckCircle,
  Info,
  Scales,
  PiggyBank,
  ShieldWarning
} from '@phosphor-icons/react';
import { useLanguage } from '@/components/app/language-context';

export type TopicCategory = 'schemes' | 'scam' | 'savings';

interface TopicDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: TopicCategory;
  onStartCallWithTopic?: (topicName: string) => void;
}

interface SchemeItem {
  id: string;
  category: 'schemes' | 'scam' | 'savings';
  tag: string;
  titleEn: string;
  titleHi: string;
  subtitle: string;
  benefit: string;
  eligibility: string;
  portalUrl: string;
  portalLabel: string;
  badgeColor: string;
  highlight?: string;
}

const SCHEMES_DATA: SchemeItem[] = [
  // GOVERNMENT SCHEMES
  {
    id: 'pm-kisan',
    category: 'schemes',
    tag: 'Agriculture & Farmers',
    titleEn: 'PM-KISAN (PM Kisan Samman Nidhi)',
    titleHi: 'प्रधानमंत्री किसान सम्मान निधि',
    subtitle: 'Direct financial assistance of ₹6,000 per year for farmer families.',
    benefit: '₹6,000 annually paid in 3 equal installments of ₹2,000 directly into bank account via DBT.',
    eligibility: 'All small & marginal landholder farmer families with cultivable land.',
    portalUrl: 'https://pmkisan.gov.in',
    portalLabel: 'Official PM-KISAN Portal',
    badgeColor: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300',
    highlight: '₹6,000/yr DBT',
  },
  {
    id: 'pmjdy',
    category: 'schemes',
    tag: 'Financial Inclusion',
    titleEn: 'PM Jan Dhan Yojana (PMJDY)',
    titleHi: 'प्रधानमंत्री जन धन योजना',
    subtitle: 'Zero-balance bank account with free RuPay debit card & overdraft facility.',
    benefit: 'Zero minimum balance, free RuPay card with ₹2 Lakh accidental insurance & ₹10,000 overdraft.',
    eligibility: 'Any Indian citizen aged 10 years or older without an existing bank account.',
    portalUrl: 'https://pmjdy.gov.in',
    portalLabel: 'PMJDY Portal',
    badgeColor: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
    highlight: 'Zero Balance & ₹2L Cover',
  },
  {
    id: 'pm-jay',
    category: 'schemes',
    tag: 'Health Insurance',
    titleEn: 'Ayushman Bharat (PM-JAY)',
    titleHi: 'आयुष्मान भारत (PM-JAY)',
    subtitle: 'Free health insurance cover up to ₹5 Lakh per family per year.',
    benefit: 'Cashless treatment across 27,000+ empaneled public & private hospitals nationwide.',
    eligibility: 'Bottom 40% vulnerable families identified based on SECC 2011 data.',
    portalUrl: 'https://pmjay.gov.in',
    portalLabel: 'NHA Ayushman Portal',
    badgeColor: 'bg-teal-950/80 border-teal-700/60 text-teal-300',
    highlight: '₹5 Lakh Free Hospitalization',
  },
  {
    id: 'pmsvanidhi',
    category: 'schemes',
    tag: 'Micro Loans',
    titleEn: 'PM SVANidhi (Street Vendor Loan)',
    titleHi: 'पीएम स्वनिधि योजना',
    subtitle: 'Collateral-free working capital loan up to ₹50,000 for street vendors.',
    benefit: 'Micro-credit loans starting at ₹10,000 up to ₹50,000 with 7% interest subsidy & cashback.',
    eligibility: 'Street vendors & hawkers operating in urban and peri-urban areas.',
    portalUrl: 'https://pmsvanidhi.mohua.gov.in',
    portalLabel: 'PM SVANidhi Portal',
    badgeColor: 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300',
    highlight: 'Up to ₹50k Micro Loan',
  },
  {
    id: 'pmsym',
    category: 'schemes',
    tag: 'Pension',
    titleEn: 'PM Shram Yogi Maandhan (PMSYM)',
    titleHi: 'प्रधानमंत्री श्रम योगी मानधन',
    subtitle: 'Assured minimum monthly pension of ₹3,000 after age 60.',
    benefit: 'Monthly pension of ₹3,000 after age 60 with 50% matching contribution from Central Govt.',
    eligibility: 'Unorganized workers (home-based, street vendors, rickshaw pullers) aged 18-40 with income < ₹15k.',
    portalUrl: 'https://maandhan.in',
    portalLabel: 'Maandhan Portal',
    badgeColor: 'bg-indigo-950/80 border-indigo-700/60 text-indigo-300',
    highlight: '₹3,000/mo Pension',
  },
  {
    id: 'mudra',
    category: 'schemes',
    tag: 'Business Credit',
    titleEn: 'PM MUDRA Yojana (PMMY)',
    titleHi: 'प्रधानमंत्री मुद्रा योजना',
    subtitle: 'Collateral-free business loans up to ₹10 Lakh for small enterprises.',
    benefit: 'Loans under 3 categories: Shishu (up to ₹50k), Kishore (₹50k-5L), Tarun (₹5L-10L).',
    eligibility: 'Micro & small non-farm enterprises, artisans, traders, and small shopkeepers.',
    portalUrl: 'https://www.mudra.org.in',
    portalLabel: 'MUDRA Portal',
    badgeColor: 'bg-purple-950/80 border-purple-700/60 text-purple-300',
    highlight: 'Up to ₹10L Business Credit',
  },

  // BANK SCAM SAFETY
  {
    id: 'helpline-1930',
    category: 'scam',
    tag: 'Emergency Helpline',
    titleEn: 'National Cyber Crime Helpline: 1930',
    titleHi: 'राष्ट्रीय साइबर अपराध हेल्पलाइन: 1930',
    subtitle: 'Immediate toll-free hotline to report financial fraud & freeze lost money.',
    benefit: 'Golden Hour Rule: Reporting within 1 hour alerts banks to block fraudulent accounts & recover money.',
    eligibility: 'Anyone who has suffered online bank, UPI, OTP, or credit/debit card fraud.',
    portalUrl: 'https://cybercrime.gov.in',
    portalLabel: 'CyberCrime.gov.in',
    badgeColor: 'bg-red-950/80 border-red-700/60 text-red-300',
    highlight: 'Call 1930 Immediately',
  },
  {
    id: 'scam-digital-arrest',
    category: 'scam',
    tag: 'Scam Warning',
    titleEn: 'Digital Arrest & Fake CBI/Police Calls',
    titleHi: 'डिजिटल अरेस्ट और फर्जी पुलिस कॉल',
    subtitle: 'Fraudsters impersonating Police/CBI threatening arrest over Skype or WhatsApp.',
    benefit: 'SAFETY RULE: Indian Police, CBI, Customs, or RBI NEVER perform digital arrests or demand money.',
    eligibility: 'Never transfer funds to any personal account to "clear investigation charges".',
    portalUrl: 'https://sachet.rbi.org.in',
    portalLabel: 'RBI Sachet Portal',
    badgeColor: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
    highlight: 'Police Never Demands Money',
  },
  {
    id: 'scam-apk-fraud',
    category: 'scam',
    tag: 'Mobile Safety',
    titleEn: 'Fake APK Files & Remote Screen Share',
    titleHi: 'नकली APK फाइलें और स्क्रीन शेयर धोखाधड़ी',
    subtitle: 'Malicious apps (AnyDesk, SBI-rewards.apk) sent via WhatsApp to steal OTPs.',
    benefit: 'SAFETY RULE: Never download .apk files from WhatsApp/SMS or grant accessibility permissions.',
    eligibility: 'Only install banking apps directly from Google Play Store or Apple App Store.',
    portalUrl: 'https://cybercrime.gov.in',
    portalLabel: 'Report Fake APKs',
    badgeColor: 'bg-rose-950/80 border-rose-700/60 text-rose-300',
    highlight: 'Do Not Install WhatsApp APKs',
  },
  {
    id: 'scam-otp-kyc',
    category: 'scam',
    tag: 'Banking Alert',
    titleEn: 'Fake Bank KYC / Account Blocked SMS',
    titleHi: 'नकली केवाईसी / खाता ब्लॉक होने का मैसेज',
    subtitle: 'Urgent SMS warning that your bank account or SIM card will be blocked.',
    benefit: 'SAFETY RULE: Banks never ask for OTP, PIN, CVV, or passwords over call/SMS.',
    eligibility: 'Always call your bank’s official helpline printed on your debit card.',
    portalUrl: 'https://sachet.rbi.org.in',
    portalLabel: 'RBI Fraud Awareness',
    badgeColor: 'bg-orange-950/80 border-orange-700/60 text-orange-300',
    highlight: 'Never Share OTP or PIN',
  },

  // SAVINGS & INSURANCE
  {
    id: 'pmjjby',
    category: 'savings',
    tag: 'Life Insurance',
    titleEn: 'PM Jeevan Jyoti Bima Yojana (PMJJBY)',
    titleHi: 'प्रधानमंत्री जीवन ज्योति बीमा योजना',
    subtitle: 'High-value term life insurance cover of ₹2 Lakh for just ₹436/year.',
    benefit: '₹2 Lakh life cover payable to nominee upon death due to any reason.',
    eligibility: 'Bank account holders aged 18 to 50 with auto-debit facility enabled.',
    portalUrl: 'https://jansuraksha.gov.in',
    portalLabel: 'Jan Suraksha Portal',
    badgeColor: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300',
    highlight: '₹2L Cover for ₹436/yr',
  },
  {
    id: 'pmsby',
    category: 'savings',
    tag: 'Accident Cover',
    titleEn: 'PM Suraksha Bima Yojana (PMSBY)',
    titleHi: 'प्रधानमंत्री सुरक्षा बीमा योजना',
    subtitle: 'Accidental death and disability cover of ₹2 Lakh for just ₹20/year.',
    benefit: '₹2 Lakh for accidental death/total disability, ₹1 Lakh for partial permanent disability.',
    eligibility: 'Bank account holders aged 18 to 70 with auto-debit enabled.',
    portalUrl: 'https://jansuraksha.gov.in',
    portalLabel: 'Jan Suraksha Portal',
    badgeColor: 'bg-teal-950/80 border-teal-700/60 text-teal-300',
    highlight: '₹2L Cover for ₹20/yr',
  },
  {
    id: 'ppf',
    category: 'savings',
    tag: 'Tax-Free Savings',
    titleEn: 'Public Provident Fund (PPF)',
    titleHi: 'लोक भविष्य निधि (PPF)',
    subtitle: 'Govt-backed 15-year tax-free long term savings scheme.',
    benefit: '7.1% interest p.a., completely tax-free returns under EEE status, 80C tax deduction.',
    eligibility: 'Any resident Indian citizen (deposit min ₹500/yr up to ₹1.5 Lakh/yr).',
    portalUrl: 'https://www.indiapost.gov.in',
    portalLabel: 'India Post Savings',
    badgeColor: 'bg-sky-950/80 border-sky-700/60 text-sky-300',
    highlight: '7.1% Tax-Free Interest',
  },
  {
    id: 'ssy',
    category: 'savings',
    tag: 'Girl Child Future',
    titleEn: 'Sukanya Samriddhi Yojana (SSY)',
    titleHi: 'सुकन्या समृद्धि योजना',
    subtitle: 'Highest interest Govt scheme dedicated to girl child education & marriage.',
    benefit: '8.2% interest p.a. (highest safe rate), tax deduction under Section 80C, tax-free maturity.',
    eligibility: 'Parents or legal guardians of a girl child under 10 years of age.',
    portalUrl: 'https://www.indiapost.gov.in',
    portalLabel: 'SSY Info Portal',
    badgeColor: 'bg-pink-950/80 border-pink-700/60 text-pink-300',
    highlight: '8.2% Interest Rate',
  },
  {
    id: 'apy',
    category: 'savings',
    tag: 'Guaranteed Pension',
    titleEn: 'Atal Pension Yojana (APY)',
    titleHi: 'अटल पेंशन योजना',
    subtitle: 'Guaranteed monthly pension between ₹1,000 to ₹5,000 after age 60.',
    benefit: 'Fixed pension guaranteed by Govt of India, nominee receives corpus upon subscriber death.',
    eligibility: 'All unorganized sector workers aged 18 to 40 holding a savings bank account.',
    portalUrl: 'https://npscra.nsdl.co.in',
    portalLabel: 'APY NSDL Portal',
    badgeColor: 'bg-violet-950/80 border-violet-700/60 text-violet-300',
    highlight: 'Guaranteed Govt Pension',
  },
];

export function TopicDetailModal({
  isOpen,
  onClose,
  initialTopic = 'schemes',
  onStartCallWithTopic,
}: TopicDetailModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TopicCategory>(initialTopic);
  const [searchQuery, setSearchQuery] = useState('');

  // Keep state synced if initialTopic changes
  React.useEffect(() => {
    setActiveTab(initialTopic);
  }, [initialTopic]);

  if (!isOpen) return null;

  const filteredItems = SCHEMES_DATA.filter((item) => {
    const matchesCategory = item.category === activeTab;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.titleHi.includes(searchQuery) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-teal-600/40 rounded-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-teal-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-amber-500 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                {activeTab === 'schemes' && <Bank className="w-5 h-5 text-amber-400" />}
                {activeTab === 'scam' && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                {activeTab === 'savings' && <PiggyBank className="w-5 h-5 text-amber-300" />}
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-emerald-100 to-amber-200">
                {activeTab === 'schemes' && t.topicsTitle1}
                {activeTab === 'scam' && t.topicsTitle2}
                {activeTab === 'savings' && t.topicsTitle3}
              </h2>
              <p className="text-xs text-teal-300/80">
                {activeTab === 'schemes' && 'Verified Indian Government Welfare Schemes & Direct Benefits'}
                {activeTab === 'scam' && 'Emergency Cyber Fraud Helpline (1930), Scam Red Flags & RBI Safety'}
                {activeTab === 'savings' && 'Government Guaranteed High-Return Savings & Insurance Policies'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Search Bar */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('schemes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'schemes'
                  ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-950/50 border border-teal-400/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              <Bank className="w-4 h-4 text-amber-400" />
              <span>{t.topicsTitle1}</span>
            </button>

            <button
              onClick={() => setActiveTab('scam')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'scam'
                  ? 'bg-gradient-to-r from-red-700 to-amber-700 text-white shadow-lg shadow-red-950/50 border border-red-400/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t.topicsTitle2}</span>
            </button>

            <button
              onClick={() => setActiveTab('savings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'savings'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              <PiggyBank className="w-4 h-4 text-amber-300" />
              <span>{t.topicsTitle3}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scheme name, eligibility, or helpline..."
              className="w-full bg-slate-950/70 border border-teal-900/50 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Emergency Alert Banner (Shown on Scam Safety Tab) */}
        {activeTab === 'scam' && (
          <div className="mx-4 mt-4 p-3.5 rounded-xl bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/90 border border-red-600/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                <WarningOctagon className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-red-300 block">Emergency Cyber Fraud Helpline: 1930</span>
                <span className="text-slate-300 text-[11px]">
                  Report within 1 hour ("Golden Hour") to freeze stolen funds immediately.
                </span>
              </div>
            </div>
            <a
              href="tel:1930"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call 1930 Now</span>
            </a>
          </div>
        )}

        {/* Modal Body / Scheme Cards Grid */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 max-h-[60vh]">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <Info className="w-8 h-8 mx-auto text-slate-500" />
              <p>No results found for "{searchQuery}"</p>
              <p className="text-[11px] text-slate-500">Try searching for words like "loan", "pension", "1930", or "tax".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-teal-600/50 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all hover:bg-slate-950/90 group"
                >
                  <div className="space-y-2">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badgeColor}`}>
                        {item.tag}
                      </span>
                      {item.highlight && (
                        <span className="text-[10px] font-extrabold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded-full">
                          {item.highlight}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-teal-200 transition-colors">
                        {item.titleEn}
                      </h3>
                      <p className="text-[11px] font-semibold text-amber-300/90">{item.titleHi}</p>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.subtitle}</p>
                    </div>

                    {/* Benefit & Eligibility */}
                    <div className="bg-slate-900/90 rounded-lg p-2.5 space-y-1.5 text-[11px] border border-slate-800">
                      <div className="flex items-start gap-1.5 text-emerald-300">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span><strong>Benefit:</strong> {item.benefit}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-300">
                        <Info className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <span><strong>Eligibility:</strong> {item.eligibility}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
                    <a
                      href={item.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-teal-300 hover:text-teal-200 font-bold hover:underline transition-colors"
                    >
                      <span>{item.portalLabel}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>

                    {onStartCallWithTopic && (
                      <button
                        onClick={() => {
                          onClose();
                          onStartCallWithTopic(item.titleEn);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-teal-950 hover:bg-teal-900 border border-teal-700/60 text-amber-300 text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Sparkle className="w-3 h-3 text-amber-400" />
                        <span>Ask Agent</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-teal-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Government Information & RBI Security Guidelines</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
