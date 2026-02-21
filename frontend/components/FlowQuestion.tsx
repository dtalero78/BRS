interface FlowQuestionProps {
  greeting?: string;
  question: string;
  subtitle?: string;
}

export default function FlowQuestion({ greeting, question, subtitle }: FlowQuestionProps) {
  return (
    <div className="mb-8 sm:mb-10">
      {greeting && (
        <p className="text-lg sm:text-xl text-gray-400 font-light mb-1">{greeting}</p>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{question}</h1>
      {subtitle && (
        <p className="text-sm sm:text-base text-gray-500 mt-2">{subtitle}</p>
      )}
    </div>
  );
}
