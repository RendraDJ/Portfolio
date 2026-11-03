import type { Story } from '../story';

export const story: Story = {
  slug: 'the-classifier',
  hook: 'An NLP pipeline that reads a company’s Outlook inbox, routes each e-mail to its category, and learns from every human correction.',
  chapters: [
    {
      tag: 'context',
      title: 'One inbox, hundreds of e-mails',
      text: 'ESCO Lifesciences, a Singapore lab-equipment maker with 1,700+ employees across 54 sites, funnels requests into one main mailbox. One person sorted it by hand. The mission: pull mail from Outlook, classify it automatically by content, and keep the essentials of a normal mailbox, including archiving.',
      points: [
        '7 categories: RFQ, Tech Inquiries, Collab, Job Application, Internal Mail, System Notification, Spam',
        'RFQ split by business line: Healthcare, Medical, Labs',
        'Tech Inquiries split by equipment: Airflow, ULT, Thermostatic, General',
        'Goal: cut the manual workload and give a clear, organised interface',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '7', label: 'top-level categories' },
          { value: '2', label: 'categories with sub-classes' },
          { value: '54', label: 'ESCO sites worldwide' },
          { value: '3', label: 'months, Singapore, 2025' },
        ],
      },
    },
    {
      tag: 'demo',
      title: 'Watch the inbox sort itself',
      text: 'Incoming e-mails arrive raw, get cleaned, embedded and labelled with a category, plus a sub-category where one applies. A human can override any prediction from a dropdown, and that correction becomes training data for the next model.',
      plain: 'Mail comes in, the AI files it in the right folder, and a person can fix its mistakes so it does better next time.',
      visual: { type: 'demo' },
    },
    {
      tag: 'architecture',
      title: 'From Outlook to dashboard',
      text: 'A FastAPI back end fetches mail through the Microsoft Graph API, strips the HTML noise, translates non-English messages, and queries saved classification models. Category and sub-category come back as JSON to a React dashboard. A Gmail/IMAP prototype was built first to study raw mail formatting while Outlook access was pending.',
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'Outlook', detail: 'Microsoft Graph API, OAuth2 token via Azure', kind: 'data' },
          { label: 'Cleaning', detail: 'BeautifulSoup HTML → text, regex disclaimer removal', kind: 'data' },
          { label: 'Translation', detail: 'Google Cloud Translation → English', kind: 'software' },
          { label: 'Embedding', detail: 'all-MiniLM-L6-v2 sentence vectors', kind: 'ai' },
          { label: 'Classifier', detail: 'SGDClassifier → category', kind: 'ai' },
          { label: 'Sub-classifier', detail: 'per-category model → RFQ / Tech sub-class', kind: 'ai' },
          { label: 'Web app', detail: 'React dashboard over a FastAPI REST API', kind: 'ui' },
        ],
      },
    },
    {
      tag: 'ai',
      title: 'Embeddings, then a hierarchy',
      text: 'Each cleaned e-mail is encoded by all-MiniLM-L6-v2, a lightweight BERT-family sentence-transformer, into a fixed-size vector that captures meaning rather than keywords. A supervised scikit-learn SGDClassifier maps that vector to a top-level category. For complex categories such as RFQ, a dedicated second model picks the sub-category. Every trained model is serialised to .pkl and reloaded at inference.',
      plain: 'The text is turned into a list of numbers that describes what it means. A first model picks the folder, a second picks the sub-folder.',
      points: [
        'Cleaning removes HTML, signatures, security banners, forwarding traces',
        'Embedding model: all-MiniLM-L6-v2 (Sentence-Transformers)',
        'Two levels: model_category.pkl, then model_subcategory_*.pkl',
      ],
      visual: {
        type: 'steps',
        items: [
          { title: 'Clean', text: 'HTML to plain text; regex filters strip disclaimers and legal footers.' },
          { title: 'Translate', text: 'Non-English mail is translated to English before encoding.' },
          { title: 'Embed', text: 'all-MiniLM-L6-v2 turns the text into a dense semantic vector.' },
          { title: 'Classify', text: 'SGDClassifier predicts the category: RFQ, Tech Inquiries, Spam…' },
          { title: 'Refine', text: 'A category-specific model predicts the sub-class, e.g. Lab, HC or Medical Sales.' },
        ],
      },
    },
    {
      tag: 'ai',
      title: 'Why BERT won',
      text: 'Three approaches were benchmarked on the same task: SVM, Random Forest and BERT. BERT gave the best accuracy and F1-score and handled context best, at the cost of slower processing. Since mail does not need to be sorted to the second, the team traded speed for correctness.',
      plain: 'The slower, smarter model was chosen because a misfiled e-mail costs more than a short wait.',
      points: [
        'Short, ambiguous or badly written mail is common in business exchanges',
        'Extra latency judged negligible for routing',
      ],
      visual: {
        type: 'compare',
        columns: ['Scores', 'Speed', 'Strength', 'Weakness'],
        rows: [
          { label: 'SVM', values: ['Good', 'Good', 'Robust accuracy/time trade-off', 'Hyperparameter-sensitive, slows on large data'] },
          { label: 'Random Forest', values: ['Lower', 'Fastest to train', 'Copes with noisy data', 'Weak on short or ambiguous mail'] },
          { label: 'BERT', values: ['Best accuracy & F1', 'Slower', 'Understands context', 'Longer processing time'], best: true },
        ],
        caption: 'Qualitative summary of the report’s comparison.',
      },
    },
    {
      tag: 'software',
      title: 'Human in the loop',
      text: 'The React front end shows the inbox with sender, subject, date, body, attachments and the predicted category, plus per-category statistics. Users sign in, correct predictions from a dropdown, add new categories or sub-categories, and forward mail to the right team. Every correction is logged, and a Retrain AI button rebuilds the models from it.',
      points: [
        'Outlook access secured with temporary OAuth2 tokens (Microsoft identity platform)',
        'REST endpoints: last-24h mail, classify, retrain',
        'Taxonomy stored in categories.json, editable from the UI',
        'Corrections logged to mail_log_enriched.csv as training examples',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'Predict', detail: 'category + sub-category shown in the inbox', kind: 'ai' },
          { label: 'Review', detail: 'user corrects via dropdown or adds a category', kind: 'ui' },
          { label: 'Log', detail: 'correction appended to the training CSV', kind: 'data' },
          { label: 'Retrain AI', detail: 'one click → retrain_models.py', kind: 'software' },
          { label: 'Reload', detail: 'new .pkl models serve the next e-mails', kind: 'ai' },
        ],
      },
    },
    {
      tag: 'algorithm',
      title: 'Embed, classify, retrain',
      text: 'The core of classif.py and retrain_models.py: clean, embed with MiniLM, predict the category, then refine with the sub-model for that category if one exists. Retraining re-encodes the logged, human-corrected e-mails and refits the classifiers.',
      plain: 'Read the mail, turn it into numbers, ask the model for a folder, and relearn from the fixes people made.',
      visual: {
        type: 'code',
        lang: 'python',
        caption: 'Simplified',
        code: `encoder = SentenceTransformer("all-MiniLM-L6-v2")

def classify(html):
    text = translate(clean(html))           # BeautifulSoup + regex
    x = encoder.encode([text])
    cat = cat_model.predict(x)[0]           # model_category.pkl
    sub = sub_models.get(cat)               # model_subcategory_*.pkl
    return cat, sub.predict(x)[0] if sub else None

def retrain(log="mail_log_enriched.csv"):
    df = pd.read_csv(log)                   # includes user corrections
    X = encoder.encode(df.text.tolist())
    cat_model = SGDClassifier().fit(X, df.category)
    joblib.dump(cat_model, "model_category.pkl")
    for cat, g in df[df.subcategory.notna()].groupby("category"):
        m = SGDClassifier().fit(encoder.encode(g.text.tolist()), g.subcategory)
        joblib.dump(m, f"model_subcategory_{cat}.pkl")`,
      },
    },
    {
      tag: 'results',
      title: 'Delivered, and what is next',
      text: 'The result is a complete web application: secure Outlook ingestion, a cleaning and translation pipeline, a two-level BERT-embedding classifier, and a dashboard where people correct the model and retrain it themselves. The report describes high precision with fast, adaptable behaviour, but publishes no per-category metrics in text.',
      points: [
        'BERT chosen over SVM and Random Forest on accuracy and F1',
        'Limit: BERT is slower, accepted for routing',
        'Next: automatic priority detection and message summarisation',
        'Next: integration with other collaborative tools and internal services',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '3', label: 'models compared' },
          { value: '7', label: 'categories, 2 levels deep' },
          { value: '1 click', label: 'retraining from the app' },
          { value: '24 h', label: 'mail window served by the API' },
        ],
      },
    },
  ],
};
