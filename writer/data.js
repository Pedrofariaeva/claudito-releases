/* Claudito Writer mockup, round 2: data taken from Claudito's own templates. */
(function () {
  "use strict";
  var CW = window.CW = window.CW || {};

  CW.TYPES = [
    { id: "plan", label: "Research plan", note: "Claudito's plan.txt outline" },
    { id: "paper", label: "Journal paper", note: "Claudito's paper_structure.txt outline" },
    { id: "conference", label: "Conference paper", note: "Proposal: not in Claudito yet" },
    { id: "thesis", label: "Thesis", note: "Proposal: not in Claudito yet" },
    { id: "proposal", label: "Research proposal (NSFC)", note: "Claudito's NSFC proposal template" }
  ];

  /* Class lines copied from claudito/templates/latex/papers/*.tex and proposals/nsfc. */
  CW.TEMPLATES = {
    "claudito": { label: "Claudito default (article)", cls: "\\documentclass{article}", types: ["plan", "paper"], needs: ["Abstract"] },
    "elsarticle": { label: "Elsevier (elsarticle)", cls: "\\documentclass[preprint,authoryear,12pt]{elsarticle}", types: ["plan", "paper"], needs: ["Abstract", "Keywords", "Highlights"] },
    "IEEEtran": { label: "IEEE (IEEEtran)", cls: "\\documentclass[journal,a4paper,10pt,onecolumn,twoside,final]{IEEEtran}", types: ["plan", "paper", "conference"], needs: ["Abstract", "Keywords"] },
    "svjour3": { label: "Springer (svjour3)", cls: "\\documentclass[twoside,journal,ms,english,12pt]{svjour3}", types: ["plan", "paper"], needs: ["Abstract", "Keywords", "Declarations"] },
    "mdpi": { label: "MDPI", cls: "\\documentclass[referee]{mdpi}", types: ["plan", "paper"], needs: ["Abstract", "Keywords"] },
    "plos": { label: "PLOS", cls: "\\documentclass[12pt]{article}", types: ["plan", "paper"], needs: ["Abstract"] },
    "taylor-francis": { label: "Taylor & Francis", cls: "\\documentclass[man,12pt,a4paper,doublespace]{agu template}", types: ["plan", "paper"], needs: ["Abstract", "Keywords"] },
    "wiley": { label: "Wiley", cls: "\\documentclass[article,12pt,a4paper,twoside,onecolumn]{wlscirep}", types: ["plan", "paper"], needs: ["Abstract", "Keywords"] },
    "acmart": { label: "ACM (acmart)", cls: "\\documentclass[sigconf,anonymous,review,balance]{acmart}", types: ["paper", "conference"], needs: ["Abstract", "Keywords"] },
    "arxiv": { label: "arXiv preprint", cls: "\\documentclass[12pt,a4paper]{article}", types: ["plan", "paper"], needs: ["Abstract"] },
    "revtex": { label: "APS / AIP (REVTeX)", cls: "\\documentclass[reprint,superscriptaddress,showkeys,nofootinbib,tightened,12pt]{revtex4-2}", types: ["paper"], needs: ["Abstract"] },
    "thesis-generic": { label: "Generic thesis (book class)", cls: "\\documentclass[12pt,oneside]{book}", types: ["thesis"], needs: ["Abstract", "Acknowledgements"], proposal: true },
    "nsfc": { label: "NSFC proposal", cls: "\\documentclass[12pt,a4paper]{article}", types: ["proposal"], needs: ["English Abstract"] }
  };
  CW.DEFAULT_TEMPLATE = { plan: "claudito", paper: "elsarticle", conference: "IEEEtran", thesis: "thesis-generic", proposal: "nsfc" };

  /* [level, title, guide]. Plan and paper guides are Claudito's own words. */
  CW.OUTLINES = {
    plan: [
      [2, "Abstract", "In 3-4 sentences: the problem, what you did, what you found."],
      [2, "1. Introduction", "Why does this paper exist — and why should anyone read it?"],
      [3, "1.1 Background", "What does the reader need to know before your work makes sense?"],
      [3, "1.2 State of Art", "What have others already done — and what is still missing?"],
      [3, "1.3 Research Approach and Objective", "What is the gap this paper closes, and how will you close it?"],
      [2, "2. Materials and Methods", "What exactly did you do, so someone could repeat it?"],
      [3, "2.1 Case Study Introduction", "What is your case study, and why this one?"],
      [3, "2.2 Systems and Workflows", "What systems, tools, or workflows did you use?"],
      [3, "2.3 Algorithms and Concepts of Proof", "Which algorithms or concepts back your approach?"],
      [3, "2.4 Modelings and First Results", "What did you model, and what are the first results?"],
      [3, "2.5 Early Conclusions", "What do the first results tell you so far?"],
      [3, "2.6 Future Work", "What stays open after this paper?"],
      [2, "3. Discussion and Results", "What did you find, and what does it mean?"],
      [3, "3.1 Further Implementations", "What did you build or improve after the first results?"],
      [3, "3.2 Further and Final Statements", "What can you now state with confidence?"],
      [3, "3.3 Final Results", "What are the final numbers or answers?"],
      [2, "4. Conclusions", "In one paragraph: what should the reader remember?"]
    ],
    paper: [
      [2, "Abstract", "150-250 words, structured: Background / Methods / Results / Conclusions."],
      [2, "Keywords", "4-6 keywords."],
      [2, "Highlights", "Elsevier, optional: 3-5 bullets of 85 characters at most."],
      [2, "1 Introduction", "About 10-15% of the paper."],
      [3, "1.1 Background / context", "What the reader needs before your work makes sense."],
      [3, "1.2 Problem statement / research gap", "What is still missing."],
      [3, "1.3 Aim, objectives & contributions", "Objective 1, objective 2, contributions."],
      [2, "2 Related work / literature review", "Optional: can fold into 1."],
      [3, "2.1 Theme A", "One theme of the literature, with its key references."],
      [3, "2.2 Theme B", "A second theme."],
      [3, "2.3 Summary of the gap this work fills", "One paragraph."],
      [2, "3 Materials and methods", "About 20-30%."],
      [3, "3.1 Study area / dataset", "Where and what."],
      [3, "3.2 Data collection", "Instruments / sources; sampling / procedure."],
      [3, "3.3 Experimental / system design", "How the study or system is built."],
      [3, "3.4 Analysis", "Pre-processing; model / algorithm; evaluation metrics and statistical tests."],
      [2, "4 Results", "About 20-30%."],
      [3, "4.1 Result group 1", "Sub-finding, with its figure or table."],
      [3, "4.2 Result group 2", "Next finding."],
      [2, "5 Discussion", "About 20-25%."],
      [3, "5.1 Interpretation of key findings", "What the results mean."],
      [3, "5.2 Comparison with prior work", "Agreements and differences."],
      [3, "5.3 Limitations", "What the study cannot claim."],
      [3, "5.4 Implications / future work", "What follows."],
      [2, "6 Conclusion", "About 5-10%, no new data."],
      [2, "Declarations", "Funding, conflict of interest, data availability, ethics approval, CRediT author contributions."],
      [2, "Acknowledgements", "Who helped."]
    ],
    conference: [
      [2, "Abstract", "150 words at most."],
      [2, "Keywords", "Index terms for IEEE, CCS concepts for ACM."],
      [2, "1 Introduction", "The problem and your contribution."],
      [2, "2 Related work", "Closest work and the gap."],
      [2, "3 Method", "What you built or did."],
      [2, "4 Evaluation", "How you tested it and what came out."],
      [2, "5 Conclusion", "What to remember."]
    ],
    thesis: [
      [2, "Abstract", "One page: problem, approach, findings, contribution."],
      [2, "Acknowledgements", "Who helped."],
      [2, "Chapter 1 Introduction", "Context, research questions, structure of the thesis."],
      [2, "Chapter 2 Literature review", "Themes of the literature and the gap."],
      [2, "Chapter 3 Methodology", "Design, data, analysis."],
      [2, "Chapter 4 Results", "Findings, chapter by chapter."],
      [2, "Chapter 5 Discussion", "Meaning, comparison, limitations."],
      [2, "Chapter 6 Conclusions", "Answers to the research questions and future work."],
      [2, "Appendices", "Questionnaires, extra tables."]
    ],
    proposal: [
      [2, "英文摘要 / English Abstract", "The whole project in one paragraph."],
      [2, "（一）立项依据 / Research Basis and Rationale", "Why this project should be funded."],
      [3, "1. 研究背景与科学问题 / Background and Scientific Problem", "The problem and why it matters."],
      [3, "2. 国内外研究现状 / Domestic and International Research Status", "What others have done."],
      [3, "3. 关键科学问题 / Key Scientific Problems", "Two or three questions."],
      [3, "4. 项目意义 / Project Significance", "Theoretical and practical significance."],
      [3, "5. 主要参考文献 / Main References", "Filled from your references."],
      [2, "（二）研究内容 / Research Content", "What the project will do."],
      [3, "1. 研究目标 / Research Objectives", "Objectives you can check at the end."],
      [3, "2. 研究内容 / Research Contents", "Work packages."]
    ]
  };

  /* Example references, marked as examples. Subjects are harvest folders
     (references/<subject>/); screening decisions use Claudito's Include / Maybe / Exclude. */
  CW.REFS = [
    { key: "Example A", year: 2023, doi: "10.0000/example.a", subject: "smart-home adoption", screen: "Include", title: "Why older adults stop using smart-home devices" },
    { key: "Example B", year: 2021, doi: "10.0000/example.b", subject: "co-design", screen: "Include", title: "Designing kitchens together with people over 75" },
    { key: "Example C", year: 2024, doi: "10.0000/example.c", subject: "sensing and privacy", screen: "Maybe", title: "Placing sensors at home without losing privacy" },
    { key: "Example D", year: 2022, doi: "10.0000/example.d", subject: "usability measures", screen: "Include", title: "Usability questionnaires for older populations" },
    { key: "Example E", year: 2020, doi: "10.0000/example.e", subject: "sensing and privacy", screen: "Include", title: "What home sensors catch and miss about falls" },
    { key: "Example F", year: 2019, doi: "10.0000/example.f", subject: "recruitment", screen: "Maybe", title: "Recruiting older participants through community centres" },
    { key: "Example G", year: 2022, doi: "10.0000/example.g", subject: "smart-home adoption", screen: "Exclude", title: "Voice assistants and loneliness in later life" },
    { key: "Example H", year: 2021, doi: "10.0000/example.h", subject: "usability measures", screen: "Include", title: "Scoring the System Usability Scale: a practical guide" }
  ];

  /* Mirrors clauditoArchive/outputs/section_rules.txt: <subject> -> section. */
  CW.SECTION_RULES = {
    "smart-home adoption": ["abstract", "introduction", "background", "state of art", "related work", "literature", "research basis"],
    "co-design": ["research approach", "objective", "methods", "case study", "design", "research content"],
    "sensing and privacy": ["systems", "workflows", "state of art", "related work", "discussion", "limitations"],
    "usability measures": ["algorithms", "analysis", "results", "evaluation", "methods"],
    "recruitment": ["case study", "data collection", "study area", "methods"]
  };

  /* Quick harvest offline stand-in: the mockup's example pool, used only when
     the page is NOT served by `clt write` (no bridge, no real search). Names
     and grades copied from databases.py. In bridge mode the server reports the
     databases that are really active on this machine. */
  CW.QH_DATABASES = {
    ready: [["CORE", "A"], ["Europe PMC", "A"], ["BASE", "A"], ["OpenAlex", "B"], ["Crossref", "B"], ["PubMed Central", "B"], ["DOAJ", "B"]],
    needKey: [["Elsevier / Scopus", "A"], ["IEEE Xplore", "A"], ["Web of Science", "A"]],
    noApi: ["Google Scholar", "ResearchGate"]
  };
  CW.QH_PATTERNS = ["A review of {a}", "{a} and {b}: a field study", "Measuring {b} at home", "Design guidelines for {a}",
    "{a}: a survey of households", "Barriers to {a} in later life", "A qualitative study of {b}", "{a} in practice: lessons from pilots",
    "Comparing tools for {b}", "{a} over two years: a follow-up study", "{b} and daily routines"];

  CW.EQ_SUGGESTIONS = [
    { name: "System Usability Scale score", words: "sus system usability scale score questionnaire", src: "SUS = 2.5 * (sum(x_odd - 1) + sum(5 - x_even))" },
    { name: "Cronbach's alpha (reliability)", words: "cronbach alpha reliability internal consistency questionnaire", src: "alpha = (k / (k - 1)) * (1 - sum(s_i^2) / s_t^2)" },
    { name: "Mean", words: "mean average", src: "M = (1 / n) * sum(x_i)" },
    { name: "Standard deviation", words: "standard deviation sd spread variance", src: "s = sqrt(sum((x_i - M)^2) / (n - 1))" },
    { name: "Thermal transmittance (U-value)", words: "u value u-value thermal transmittance heat loss insulation wall window", src: "U = 1 / (R_si + sum(d_j / lambda_j) + R_se)" },
    { name: "Linear regression", words: "linear regression model predict slope", src: "y = beta_0 + beta_1 * x + epsilon" },
    { name: "Sample size for a proportion", words: "sample size participants how many proportion survey", src: "n = (z^2 * p * (1 - p)) / e^2" },
    { name: "Percentage", words: "percentage percent share", src: "P = 100 * part / total" }
  ];

  CW.COMMANDS = [
    { id: "h2", label: "Heading", words: "heading title section" },
    { id: "h3", label: "Subheading", words: "subheading subsection" },
    { id: "ul", label: "Bullet list", words: "list bullet bullets points" },
    { id: "ol", label: "Numbered list", words: "numbered list ordered numbers" },
    { id: "table", label: "Table", words: "table grid csv rows columns" },
    { id: "fig1", label: "Figure with 1 image", words: "figure image picture photo" },
    { id: "fig2", label: "Figure with 2 images", words: "figure images two side subfigure" },
    { id: "fig3", label: "Figure with 3 images", words: "figure images three subfigure" },
    { id: "equation", label: "Equation", words: "equation formula math maths" },
    { id: "cite", label: "Cite a reference", words: "cite citation reference paper source" },
    { id: "assistant", label: "Open the assistant", words: "assistant ai help ollama ask" },
    { id: "txt", label: "Show the text file", words: "text file txt project plain" },
    { id: "latex", label: "Show LaTeX", words: "latex tex overleaf pdf" }
  ];

  var PLAN_SVG = '<svg class="plan" viewBox="0 0 320 172" role="img" aria-label="Floor plan of a one-bedroom flat with four sensors">' +
    '<rect class="wall" x="6" y="6" width="308" height="160"/>' +
    '<line class="wall" x1="172" y1="6" x2="172" y2="70"/><line class="wall" x1="172" y1="96" x2="172" y2="166"/>' +
    '<line class="wall" x1="172" y1="96" x2="314" y2="96"/><line class="wall" x1="6" y1="112" x2="92" y2="112"/>' +
    '<text class="room" x="89" y="60">Living room</text><text class="room" x="243" y="54">Bedroom</text>' +
    '<text class="room" x="243" y="136">Bathroom</text><text class="room" x="49" y="144">Kitchen</text>' +
    '<circle class="sensor" cx="30" cy="30" r="5.5"/><circle class="sensor" cx="290" cy="30" r="5.5"/>' +
    '<circle class="sensor" cx="290" cy="146" r="5.5"/><circle class="sensor" cx="80" cy="126" r="5.5"/></svg>';

  /* Example weekly sensor events; bar height = value * 0.8 on a 0-150 scale. */
  var BARS_SVG = (function () {
    var data = [["Living", 142], ["Kitchen", 118], ["Bedroom", 64], ["Bath", 51]], out = "";
    data.forEach(function (d, i) {
      var h = d[1] * 0.8, x = 36 + i * 70, y = 146 - h;
      out += '<rect class="bar" x="' + x + '" y="' + y + '" width="44" height="' + h + '"/>' +
        '<text class="val" x="' + (x + 22) + '" y="' + (y - 5) + '">' + d[1] + '</text>' +
        '<text class="room" x="' + (x + 22) + '" y="162">' + d[0] + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 320 172" role="img" aria-label="Example sensor events per room in one week">' +
      '<line class="axis" x1="24" y1="146" x2="310" y2="146"/>' + out + '</svg>';
  })();

  function sections(outline, fill) {
    var blocks = [];
    outline.forEach(function (s) {
      blocks.push({ t: "h", level: s[0], text: s[1] });
      var extra = fill[s[1]] || [];
      var first = extra[0] && extra[0].t === "p" ? extra.shift() : { t: "p", text: "" };
      first.guide = s[2];
      blocks.push(first);
      extra.forEach(function (b) { blocks.push(b); });
    });
    return blocks;
  }

  CW.sampleDoc = function () {
    var fill = {
      "Abstract": [{ t: "p", text: "Older adults often stop using smart-home devices that add steps to daily tasks. This project co-designs household equipment with people over 65 in their own homes and measures usability with the System Usability Scale." }],
      "1.1 Background": [{ t: "p", text: "Most smart-home products are tested with younger people, and a device tends to be abandoned when it asks for more steps than the task it replaces [CITE: 10.0000/example.a]." }],
      "1.3 Research Approach and Objective": [{ t: "p", text: "How can household equipment designed **with** older adults, rather than for them, support independent living without adding steps to everyday tasks?" }],
      "2.1 Case Study Introduction": [
        { t: "p", text: "Participants are recruited through two community centres." },
        { t: "table", name: "tables/participants.csv", caption: "Example participants by age group and living situation",
          rows: [["Age group", "Living alone", "With a carer"], ["65–74", "12", "5"], ["75–84", "9", "8"], ["85 and over", "3", "7"]] }
      ],
      "2.2 Systems and Workflows": [
        { t: "p", text: "" },
        { t: "figure", images: ["figures/sensor-plan.svg", "figures/events-per-room.svg"], caption: "Example home: (a) sensor positions, (b) sensor events per room in one week" }
      ],
      "2.3 Algorithms and Concepts of Proof": [
        { t: "p", text: "Each device gets a System Usability Scale score: ten answers from 1 to 5 become one number from 0 to 100." },
        { t: "eq", src: "SUS = 2.5 * (sum(x_odd - 1) + sum(5 - x_even))" }
      ]
    };
    return {
      type: "plan",
      template: "claudito",
      blocks: [{ t: "h", level: 1, text: "Household equipment for ageing at home" }].concat(sections(CW.OUTLINES.plan, fill)),
      images: { "figures/sensor-plan.svg": PLAN_SVG, "figures/events-per-room.svg": BARS_SVG }
    };
  };

  CW.outlineBlocks = function (type) {
    return sections(CW.OUTLINES[type] || CW.OUTLINES.plan, {});
  };
})();
