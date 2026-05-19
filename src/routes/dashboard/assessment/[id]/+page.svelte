<script lang="ts">
  import { page } from '$app/stores';
  import { fade, slide, scale } from 'svelte/transition';

  // Extract ID
  const moduleId = $page.params.id;
  const moduleName = moduleId === 'coc' ? 'Code of Conduct' :
                     moduleId === 'posh' ? 'Prevention of Sexual Harassment' :
                     moduleId === 'coi' ? 'Conflict of Interest' :
                     moduleId === 'pit' ? 'Prevention of Insider Trading' : 'Compliance Module';

  // View state: 'intro' | 'exam' | 'results'
  let currentView = $state<'intro' | 'exam' | 'results'>('intro');

  // Mock 10 unique questions for the module
  const mockQuestions = [
    {
      id: "q1",
      subTopic: "Gifts & Entertainment",
      text: "A vendor offers you a $500 gift card during the holidays. According to our policy, what is the appropriate action?",
      options: [
        { id: "A", text: "Accept it quietly, as it is a holiday." },
        { id: "B", text: "Accept it but report it to your manager immediately." },
        { id: "C", text: "Politely decline, as it exceeds the $100 allowable limit." },
        { id: "D", text: "Accept it on behalf of the company and use it for a team lunch." }
      ],
      correctId: "C",
      explanation: "Our policy strictly prohibits accepting gifts valued over $100 to prevent any appearance of undue influence or bribery."
    },
    {
      id: "q2",
      subTopic: "Data Privacy",
      text: "You find an unlocked laptop in the cafeteria showing sensitive employee salary data. What should you do?",
      options: [
        { id: "A", text: "Close the laptop and leave it there." },
        { id: "B", text: "Lock the screen, secure the device, and notify IT or Security." },
        { id: "C", text: "Take a quick look to see if you are being paid fairly." },
        { id: "D", text: "Try to find the owner by asking people nearby loudly." }
      ],
      correctId: "B",
      explanation: "You must immediately lock unattended devices displaying sensitive data and report it to IT to ensure data security protocols are maintained."
    },
    {
      id: "q3",
      subTopic: "Workplace Respect",
      text: "A colleague repeatedly makes offensive jokes that make others uncomfortable. What is the best course of action?",
      options: [
        { id: "A", text: "Ignore it, they are just jokes." },
        { id: "B", text: "Laugh along to avoid creating tension." },
        { id: "C", text: "Ask them politely to stop, and report to HR if the behavior continues." },
        { id: "D", text: "Make offensive jokes back at them." }
      ],
      correctId: "C",
      explanation: "We maintain a zero-tolerance policy for harassment. Addressing it directly and professionally, followed by HR escalation, is the correct protocol."
    },
    {
      id: "q4",
      subTopic: "Insider Trading",
      text: "You accidentally learn about an unannounced merger. Can you buy stock in the company?",
      options: [
        { id: "A", text: "Yes, as long as I don't tell anyone else." },
        { id: "B", text: "No, trading on non-public material information is illegal." },
        { id: "C", text: "Yes, but only a small amount of shares." },
        { id: "D", text: "Only if my manager approves it." }
      ],
      correctId: "B",
      explanation: "Trading on Material Non-Public Information (MNPI) is a severe federal offense (Insider Trading) and strictly prohibited."
    },
    {
      id: "q5",
      subTopic: "Social Media",
      text: "Can you post a picture of a prototype product on your personal social media?",
      options: [
        { id: "A", text: "Yes, if your account is private." },
        { id: "B", text: "Yes, if you don't mention the company name." },
        { id: "C", text: "No, confidential IP cannot be shared externally." },
        { id: "D", text: "Yes, to build hype for the launch." }
      ],
      correctId: "C",
      explanation: "Proprietary information and prototypes are strictly confidential and must never be leaked to public forums or social media."
    },
    {
      id: "q6",
      subTopic: "Conflicts of Interest",
      text: "You are responsible for hiring a vendor, and your spouse owns one of the bidding companies. What must you do?",
      options: [
        { id: "A", text: "Hire them, because you know they do good work." },
        { id: "B", text: "Disclose the relationship and recuse yourself from the decision." },
        { id: "C", text: "Don't tell anyone to ensure a fair process." },
        { id: "D", text: "Hire a different company to avoid any questions." }
      ],
      correctId: "B",
      explanation: "Any potential conflict of interest must be formally disclosed to compliance/HR, and you must recuse yourself from the procurement decision."
    },
    {
      id: "q7",
      subTopic: "Health & Safety",
      text: "You notice a frayed electrical cord in the breakroom. What is the correct response?",
      options: [
        { id: "A", text: "Fix it yourself with tape." },
        { id: "B", text: "Ignore it, it's not your job." },
        { id: "C", text: "Unplug it if safe, and report it to facilities management immediately." },
        { id: "D", text: "Wait to see if someone else reports it." }
      ],
      correctId: "C",
      explanation: "Safety is everyone's responsibility. Potential hazards must be isolated and reported to facilities immediately."
    },
    {
      id: "q8",
      subTopic: "Whistleblowing",
      text: "If you report a suspected policy violation in good faith, will you face retaliation?",
      options: [
        { id: "A", text: "Yes, if the person I reported finds out." },
        { id: "B", text: "No, the company strictly prohibits retaliation against whistleblowers." },
        { id: "C", text: "Only if my suspicion turns out to be wrong." },
        { id: "D", text: "Yes, it will impact my performance review." }
      ],
      correctId: "B",
      explanation: "We enforce a strict non-retaliation policy to protect employees who report ethical or legal concerns in good faith."
    },
    {
      id: "q9",
      subTopic: "Phishing & Security",
      text: "You receive an urgent email from the 'CEO' asking for a wire transfer, but the email address looks slightly off. What do you do?",
      options: [
        { id: "A", text: "Reply to ask if it's really them." },
        { id: "B", text: "Execute the wire transfer immediately to show efficiency." },
        { id: "C", text: "Report the email using the Phishing Alert button and do not reply." },
        { id: "D", text: "Forward it to all your coworkers to warn them." }
      ],
      correctId: "C",
      explanation: "This is a classic Business Email Compromise (BEC) attack. Never reply; report it directly to IT security."
    },
    {
      id: "q10",
      subTopic: "Record Management",
      text: "How should you dispose of physical documents containing confidential client information?",
      options: [
        { id: "A", text: "Throw them in the regular recycling bin." },
        { id: "B", text: "Take them home to shred." },
        { id: "C", text: "Place them in the designated secure shredding consoles." },
        { id: "D", text: "Keep them indefinitely in your desk drawer." }
      ],
      correctId: "C",
      explanation: "Confidential physical records must be destroyed securely using approved shredding consoles to comply with data protection laws."
    }
  ];

  // Exam state
  let currentQuestionIndex = $state(0);
  let selectedOptionId = $state<string | null>(null);
  let hasAnswered = $state(false);
  
  // History tracking
  let examHistory = $state<{ question: typeof mockQuestions[0], selectedId: string, isCorrect: boolean }[]>([]);

  let currentQuestion = $derived(mockQuestions[currentQuestionIndex]);
  let progressPercentage = $derived(((currentQuestionIndex) / mockQuestions.length) * 100);

  // Derived Results state
  let totalScore = $derived(examHistory.filter(h => h.isCorrect).length);
  let scorePercentage = $derived((totalScore / mockQuestions.length) * 100);
  let isPassing = $derived(scorePercentage >= 80);

  function startExam() {
    currentView = 'exam';
  }

  function handleSelectOption(optId: string) {
    if (hasAnswered) return;
    selectedOptionId = optId;
    hasAnswered = true;

    // Record answer
    examHistory.push({
      question: currentQuestion,
      selectedId: optId,
      isCorrect: optId === currentQuestion.correctId
    });
  }

  function nextQuestion() {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      currentQuestionIndex++;
      selectedOptionId = null;
      hasAnswered = false;
    } else {
      currentView = 'results';
    }
  }

  function retakeExam() {
    examHistory = [];
    currentQuestionIndex = 0;
    selectedOptionId = null;
    hasAnswered = false;
    currentView = 'intro';
  }
</script>

<svelte:head>
  <title>Assessment: {moduleName} | CompliancePro</title>
</svelte:head>

<!-- We use a fixed full-screen overlay to hide the sidebar/header layout specifically for the exam view to maximize focus -->
<div class="fixed inset-0 z-[100] bg-background overflow-y-auto relative">

  <!-- Floating compliance icons inside the full-screen exam overlay -->
  <div class="fixed inset-0 pointer-events-none select-none overflow-hidden z-0" aria-hidden="true">
    <!-- Books -->
    <span class="floating-bg-icon" style="top:8%;left:3%;font-size:2rem;animation-duration:7s;animation-delay:0s">📚</span>
    <span class="floating-bg-icon" style="top:65%;left:2%;font-size:1.8rem;animation-duration:9s;animation-delay:1.5s">📖</span>
    <!-- Pens -->
    <span class="floating-bg-icon" style="top:22%;right:3%;font-size:1.9rem;animation-duration:8s;animation-delay:0.8s">🖊️</span>
    <span class="floating-bg-icon" style="top:55%;right:2%;font-size:1.7rem;animation-duration:10s;animation-delay:2.2s">✍️</span>
    <!-- Laptop / PC -->
    <span class="floating-bg-icon" style="top:40%;left:3%;font-size:2rem;animation-duration:8.5s;animation-delay:3s">💻</span>
    <span class="floating-bg-icon" style="bottom:12%;right:4%;font-size:1.8rem;animation-duration:7.5s;animation-delay:1s">🖥️</span>
    <!-- Documents -->
    <span class="floating-bg-icon" style="top:12%;right:6%;font-size:1.9rem;animation-duration:11s;animation-delay:4s">📋</span>
    <span class="floating-bg-icon" style="bottom:20%;left:4%;font-size:1.7rem;animation-duration:9.5s;animation-delay:0.5s">📜</span>
    <span class="floating-bg-icon" style="top:75%;right:5%;font-size:1.8rem;animation-duration:8s;animation-delay:2.5s">📝</span>
    <!-- Compliance icons -->
    <span class="floating-bg-icon" style="top:5%;left:40%;font-size:1.7rem;animation-duration:12s;animation-delay:5s">⚖️</span>
    <span class="floating-bg-icon" style="bottom:5%;left:30%;font-size:1.9rem;animation-duration:8s;animation-delay:1.8s">🎓</span>
    <span class="floating-bg-icon" style="top:48%;right:5%;font-size:1.7rem;animation-duration:9s;animation-delay:3.5s">🔒</span>
    <span class="floating-bg-icon" style="top:30%;left:5%;font-size:1.6rem;animation-duration:10s;animation-delay:2.8s">🏆</span>
    <span class="floating-bg-icon" style="top:85%;left:50%;font-size:1.8rem;animation-duration:7s;animation-delay:0.3s">📊</span>
    <span class="floating-bg-icon" style="top:15%;left:12%;font-size:1.6rem;animation-duration:9s;animation-delay:4.5s">📁</span>
  </div>
  
  {#if currentView === 'intro'}
    <!-- INTRO SCREEN -->
    <div transition:fade class="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <a href="/dashboard" class="absolute top-6 left-6 text-sm font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Back to Dashboard
      </a>

      <div class="bg-white p-8 md:p-12 rounded-2xl shadow-xl shadow-slate-200/50 max-w-xl w-full text-center border border-slate-100">
        <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Certification Module</h2>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">{moduleName}</h1>
        <p class="text-slate-500 font-medium mb-8">This assessment contains exactly 10 unique, randomly selected questions covering various sub-topics. You need a minimum score of 80% to pass.</p>
        
        <div class="space-y-4">
          <button onclick={startExam} class="w-full py-4 bg-primary hover:opacity-95 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
            Begin Certification Exam
          </button>
        </div>
      </div>
    </div>
  
  {:else if currentView === 'exam'}
    <!-- EXAM INTERFACE SCREEN -->
    <div transition:fade class="min-h-screen flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full">
      
      <!-- Exam Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{moduleName}</h2>
          <div class="text-2xl font-black text-slate-800 tracking-tight mt-1">Question {currentQuestionIndex + 1} of {mockQuestions.length}</div>
        </div>
        <a href="/dashboard" class="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
          Exit Exam
        </a>
      </div>

      <!-- Progress Bar -->
      <div class="h-2 w-full bg-slate-200 rounded-full mb-8 overflow-hidden">
        <div class="h-full bg-primary rounded-full transition-all duration-500 ease-out" style="width: {progressPercentage}%"></div>
      </div>

      <!-- Question Card -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 p-6 md:p-10 flex-1 flex flex-col relative">
        <span class="inline-block px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-extrabold uppercase rounded border border-slate-200/50 mb-6 self-start tracking-wider">
          {currentQuestion.subTopic}
        </span>
        
        <h3 class="text-xl md:text-2xl font-bold text-slate-800 leading-snug mb-8">
          {currentQuestion.text}
        </h3>

        <!-- Options Grid -->
        <div class="space-y-3 mb-8">
          {#each currentQuestion.options as opt}
            <button 
              disabled={hasAnswered}
              onclick={() => handleSelectOption(opt.id)}
              class="w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group flex items-center justify-between
                { !hasAnswered ? 'border-slate-200 bg-white hover:border-primary/50 hover:bg-slate-50' : '' }
                { hasAnswered && opt.id === currentQuestion.correctId ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900' : '' }
                { hasAnswered && opt.id === selectedOptionId && opt.id !== currentQuestion.correctId ? 'border-rose-500 bg-rose-50 text-rose-900' : '' }
                { hasAnswered && opt.id !== selectedOptionId && opt.id !== currentQuestion.correctId ? 'border-slate-200 bg-slate-50 opacity-50' : '' }
              "
            >
              <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                  { !hasAnswered ? 'bg-slate-100 text-slate-500 group-hover:bg-primary group-hover:text-white' : '' }
                  { hasAnswered && opt.id === currentQuestion.correctId ? 'bg-emerald-500 text-white' : '' }
                  { hasAnswered && opt.id === selectedOptionId && opt.id !== currentQuestion.correctId ? 'bg-rose-500 text-white' : '' }
                  { hasAnswered && opt.id !== selectedOptionId && opt.id !== currentQuestion.correctId ? 'bg-slate-100 text-slate-400' : '' }
                  transition-colors
                ">
                  {opt.id}
                </div>
                <span class="font-semibold {hasAnswered && opt.id === currentQuestion.correctId ? 'text-emerald-800' : 'text-slate-700'}">{opt.text}</span>
              </div>
              
              <!-- Result Icon Indicator -->
              {#if hasAnswered}
                {#if opt.id === currentQuestion.correctId}
                  <div transition:scale class="text-emerald-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                {:else if opt.id === selectedOptionId}
                  <div transition:scale class="text-rose-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </div>
                {/if}
              {/if}
            </button>
          {/each}
        </div>

        <!-- Explanation Block -->
        {#if hasAnswered}
          <div transition:slide={{axis: 'y'}} class="mt-auto border-t border-slate-100 pt-6">
            <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              {#if selectedOptionId === currentQuestion.correctId}
                <span class="text-emerald-600">Correct Answer</span>
              {:else}
                <span class="text-rose-600">Incorrect Answer</span>
              {/if}
            </h4>
            <p class="text-sm font-medium text-slate-600 leading-relaxed mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {currentQuestion.explanation}
            </p>
            
            <button onclick={nextQuestion} class="w-full py-4 bg-slate-900 hover:bg-black text-white text-sm font-extrabold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              {currentQuestionIndex < mockQuestions.length - 1 ? 'Next Question' : 'View Final Results'}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        {/if}

      </div>
    </div>
  
  {:else if currentView === 'results'}
    <!-- RESULTS SCREEN -->
    <div transition:fade class="min-h-screen p-4 md:p-8 max-w-4xl mx-auto w-full pb-20">
      
      <!-- Results Header -->
      <div class="text-center mb-10">
        <h2 class="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Certification Results</h2>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">{moduleName}</h1>
      </div>

      <!-- Main Score Card -->
      <div class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-12 text-center relative overflow-hidden mb-8">
        <!-- Confetti / Status Decoration -->
        <div class="text-7xl mb-6 transform hover:scale-110 transition-transform cursor-default">
          {isPassing ? '🏆' : '📖'}
        </div>
        
        <h3 class="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
          {scorePercentage}%
        </h3>
        <p class="text-lg font-bold text-slate-500 mb-8">You scored {totalScore} out of {mockQuestions.length} correct.</p>

        <!-- Status Badge -->
        <div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 
          {isPassing ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}">
          {#if isPassing}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            <span class="font-extrabold uppercase tracking-widest text-xs">Passed</span>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            <span class="font-extrabold uppercase tracking-widest text-xs">Failed</span>
          {/if}
        </div>

        <!-- Progress Bar Visualizer -->
        <div class="max-w-md mx-auto mt-8 relative">
          <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-1000 
              {scorePercentage >= 80 ? 'bg-emerald-500' : scorePercentage >= 60 ? 'bg-amber-400' : 'bg-rose-500'}"
              style="width: {scorePercentage}%">
            </div>
          </div>
          <div class="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>0%</span>
            <span>Passing Threshold (80%)</span>
            <span>100%</span>
          </div>
          <div class="absolute top-0 bottom-0 left-[80%] w-0.5 bg-slate-800/20 h-6 -mt-1.5"></div>
        </div>

        <div class="flex flex-col sm:flex-row justify-center gap-4 mt-14 relative z-10">
          <button onclick={retakeExam} class="px-8 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl border border-slate-200 transition-all active:scale-95">
            Retake Module Exam
          </button>
          <a href="/dashboard" class="px-8 py-3.5 bg-primary hover:opacity-95 text-white font-extrabold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
            Return to Dashboard
          </a>
        </div>
      </div>

      <!-- Question Review Log -->
      <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6 text-center">Comprehensive Audit Review</h3>
      
      <div class="space-y-6">
        {#each examHistory as hist, i}
          <div class="bg-white rounded-2xl border {hist.isCorrect ? 'border-emerald-100' : 'border-rose-100'} shadow-sm p-6 relative overflow-hidden">
            <!-- Correct/Wrong strip -->
            <div class="absolute left-0 top-0 bottom-0 w-1.5 {hist.isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}"></div>
            
            <div class="flex items-start justify-between gap-4 mb-4 pl-3">
              <h4 class="text-base font-bold text-slate-800 leading-snug">
                <span class="text-slate-400 font-mono text-sm mr-2">{i + 1}.</span>
                {hist.question.text}
              </h4>
              <div class="shrink-0 pt-0.5">
                {#if hist.isCorrect}
                  <span class="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-extrabold uppercase rounded border border-emerald-100">Correct</span>
                {:else}
                  <span class="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-extrabold uppercase rounded border border-rose-100">Wrong</span>
                {/if}
              </div>
            </div>

            <div class="pl-3 space-y-4">
              <!-- Selected / Correct Answers -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {#if !hist.isCorrect}
                  <div class="bg-rose-50/50 border border-rose-100/50 rounded-lg p-3">
                    <span class="text-[9px] font-bold text-rose-400 uppercase tracking-wider block mb-1">You Selected ({hist.selectedId})</span>
                    <span class="text-sm font-semibold text-rose-800">{hist.question.options.find(o => o.id === hist.selectedId)?.text}</span>
                  </div>
                {/if}
                <div class="bg-emerald-50/50 border border-emerald-100/50 rounded-lg p-3 {hist.isCorrect ? 'sm:col-span-2' : ''}">
                  <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Correct Answer ({hist.question.correctId})</span>
                  <span class="text-sm font-semibold text-emerald-900">{hist.question.options.find(o => o.id === hist.question.correctId)?.text}</span>
                </div>
              </div>

              <!-- Explanation block -->
              <div class="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Official Policy Explanation</span>
                <p class="text-xs font-medium text-slate-600 leading-relaxed">{hist.question.explanation}</p>
              </div>
            </div>

          </div>
        {/each}
      </div>

    </div>
  {/if}

</div>
