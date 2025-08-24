import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Typing Quest</h1>
        <p className="text-xl text-gray-600 mb-8">
          RPG Style Typing Game for English Learners
        </p>
        <Link
          href="/game"
          className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          Start Game
        </Link>
      </div>
    </div>
  );
}
