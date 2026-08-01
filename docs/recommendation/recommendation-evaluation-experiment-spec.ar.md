# ImpactLoop Recommendation Evaluation & Experiment Specification

**الإصدار:** 1.0
**الحالة:** قرارات تقييم مثبتة — التقنيات ما زالت تحت التجربة
**النطاق:** توصيات المواد والمشاريع للمتعلم
**الهدف:** اختيار أبسط نظام يحقق أفضل جودة قابلة للإثبات، مع أداء وموثوقية مناسبين للإنتاج

---

# 1. لماذا نحتاج هذه المواصفة؟

المشكلة التي نريد منعها هي:

```text
اختيار LightFM أو Two-Tower أو Qdrant
→ تنفيذ بنية كبيرة
→ اكتشاف لاحقًا أنها لا تحسن النتائج
```

المنهج المعتمد سيكون:

```text
تعريف النجاح
→ تسجيل البيانات الصحيحة
→ بناء Baselines
→ تجربة كل تقنية منفصلة
→ قياس الجودة والأداء
→ Shadow testing
→ Online validation
→ اعتماد أو رفض التقنية
```

لا توجد خوارزمية تُعتمد لأنها:

* مستخدمة لدى شركة عالمية.
* تحتوي Machine Learning.
* أحدث من النظام الحالي.
* حققت نتائج جيدة على MovieLens.
* تبدو أقوى نظريًا.
* نجحت على بيانات seed اصطناعية.

كل قرار يجب أن ينجح على بيانات وحالات استخدام ImpactLoop.

---

# 2. قرار المنتج الذي يدعمه النظام

السؤال الذي يجب أن يجيب عنه النظام هو:

> ما المواد أو المشاريع الأكثر فائدة وقابلية للتنفيذ لهذا المتعلم في هذا الوقت؟

وليس فقط:

> ما العنصر الذي يُحتمل أن يضغط عليه المستخدم؟

الهدف النهائي لـ ImpactLoop هو:

```text
توصية مفيدة
→ فتح أو حفظ
→ حجز ناجح
→ استلام أو توصيل ناجح
→ إعادة استخدام المادة أو التقدم في المشروع
```

لذلك لا يجوز تحسين click-through rate على حساب:

* مواد بعيدة وغير قابلة للوصول.
* مواد غير متاحة.
* مواد لا تناسب المشروع.
* حجوزات تُلغى لاحقًا.
* ظهور متكرر لمورد واحد.
* إهمال المواد الجديدة.
* انخفاض التنوع.

---

# 3. Recommendation Surfaces

لن نعامل كل الأماكن التي تعرض توصيات كمسألة واحدة.

## 3.1 Suggested Materials

السؤال:

> ما المواد العامة المناسبة لهذا المتعلم؟

الإشارات الرئيسية:

* الاهتمامات.
* سلوك المواد السابق.
* الموقع.
* السعر.
* التوصيل.
* المشاريع المحفوظة.
* الشعبية والحداثة.
* قابلية التنفيذ.

## 3.2 Materials for Saved or Active Projects

السؤال:

> ما المواد التي تساعد المستخدم على إكمال مكونات مشروع محدد؟

الإشارات الرئيسية:

* Component requirements.
* Missing components.
* Material capabilities.
* Substitution compatibility.
* الكمية والحالة.
* التوافق التقني.
* الموقع والتوفر.

هذه أقرب إلى **Knowledge and Relevance Retrieval** من Collaborative Recommendation.

## 3.3 Suggested Projects

السؤال:

> ما المشاريع التي تناسب اهتمامات المستخدم وقدراته والمواد المتوفرة له؟

الإشارات:

* الاهتمامات.
* المشاريع المحفوظة والمبنية.
* المهارات.
* مستوى الصعوبة.
* المكونات المطلوبة.
* توفر مواد ملائمة.
* الشعبية والحداثة.

## 3.4 Free or Nearby Materials

هذه أقسام ذات constraints واضحة:

```text
isFree = true
أو
distance within acceptable range
```

التخصيص داخلها مفيد، لكن constraint يسبق النموذج.

## 3.5 Search Recommendations

البحث له query صريح، ولذلك يجب تقييمه منفصلًا عن Home recommendations.

مثال:

```text
"لوحة تحكم لمشروع ري ذكي"
```

هنا lexical وsemantic retrieval أكثر أهمية من collaborative behavior.

---

# 4. Eligible Universe

قبل أي scoring أو ranking، نحدد العناصر المسموح أصلًا بعرضها.

## 4.1 Material Eligibility

المادة لا تدخل candidate universe إلا إذا تحقق، بحسب سياق القسم:

```text
status = AVAILABLE
availableQuantity > 0
supplier is active
material is not owned by the learner
material is not blocked or hidden
reservation holds do not consume all quantity
pickup or delivery is feasible
material is visible to the learner's role
```

يمكن لبعض الأقسام إضافة شروط أخرى:

```text
isFree = true
deliveryAllowed = true
category = selected category
```

## 4.2 Project Eligibility

```text
status = PUBLISHED
project is not hidden or archived
project is visible to learners
required content is complete
```

## 4.3 قاعدة ثابتة

**النموذج لا يملك صلاحية تجاوز Eligibility.**

أي نموذج يمكنه فقط ترتيب العناصر المؤهلة.

---

# 5. Primary Product Metrics

لن نستخدم عشرات المقاييس كأهداف متساوية.

## 5.1 Primary Metric A — Recommendation-Assisted Successful Reuse Rate

### التعريف

نسبة recommendation impressions التي أدت، ضمن attribution window، إلى حجز مكتمل أو إعادة استخدام ناجحة.

```text
Recommendation-Assisted Successful Reuse Rate =
عدد المواد الموصى بها التي انتهت بحجز/إعادة استخدام ناجحة
÷
عدد recommendation impressions المؤهلة
```

### سبب اختيارها

لأنها الأقرب إلى قيمة ImpactLoop الحقيقية.

### الخطر

قد تتحرك ببطء، خصوصًا عندما يكون عدد المستخدمين قليلًا.

### الاستخدام

Primary outcome metric للتجارب طويلة المدة، وليست metric يومية وحيدة.

---

## 5.2 Primary Metric B — Recommendation-Assisted Reservation Completion Rate

```text
Completed recommended reservations
÷
Created reservations originating from recommendations
```

تفرق هذه metric بين:

* recommendation أدت إلى click فقط.
* recommendation أدت إلى حجز.
* recommendation أدت إلى حجز مكتمل بنجاح.

انخفاضها قد يعني أن النظام يقترح عناصر جذابة لكنها غير عملية.

---

## 5.3 Primary Metric C — Project Component Fulfillment Rate

لأقسام المواد المرتبطة بالمشاريع:

```text
عدد مكونات المشروع التي تم ربطها أو حجزها من التوصيات
÷
عدد المكونات الناقصة المؤهلة
```

هذه metric أهم من click rate في `materials_for_saved_projects`.

---

# 6. Driver Metrics

تساعدنا على معرفة أين تحسن أو تراجع النظام.

## 6.1 Recommendation Open Rate

```text
تفاصيل المواد المفتوحة من recommendation impressions المرئية
÷
عدد recommendation impressions المرئية
```

## 6.2 Save/Like Rate

```text
عدد save أو like
÷
عدد impressions المرئية
```

## 6.3 Reservation Start Rate

```text
عدد مرات بدء تدفق الحجز
÷
عدد impressions المرئية
```

## 6.4 Reservation Creation Rate

```text
عدد الحجوزات المنشأة
÷
عدد impressions المرئية
```

## 6.5 Time to First Useful Action

الوقت من فتح Home إلى أول:

* فتح مفيد.
* حفظ.
* like.
* reservation start.
* component link.

---

# 7. Guardrail Metrics

أي نموذج يرفع primary metric لكنه يخرق guardrail أساسية يُرفض.

## 7.1 Eligibility Validity Rate

```text
عدد النتائج المؤهلة فعليًا وقت الاستجابة
÷
إجمالي النتائج المعادة
```

**المطلوب:** 100% ضمن حدود consistency المتفق عليها.

## 7.2 Availability Staleness Rate

نسبة المواد التي ظهرت للمستخدم ثم تبين عند فتحها أنها لم تعد متاحة بسبب بيانات stale.

## 7.3 Recommendation Error Rate

نسبة requests التي فشلت بسبب recommendation path.

## 7.4 Fallback Rate

نسبة requests التي عادت إلى fallback بسبب:

* Model unavailable.
* Feature unavailable.
* Index failure.
* Timeout.
* No sufficient candidates.

## 7.5 Supplier Concentration

نسبة العناصر التابعة لأكثر مورد ظهورًا داخل القائمة أو القسم.

## 7.6 Category Concentration

قياس سيطرة تصنيف واحد على القائمة.

## 7.7 Cancellation and Rejection Rate

لا نقبل نموذجًا يزيد الحجوزات إذا زادت معه:

* الإلغاءات.
* رفض المورد.
* انتهاء نافذة الاستلام.
* AWAITING_RESOLUTION.
* no-show incidents.

## 7.8 Latency

الأهداف المبدئية:

| المسار                         | الهدف المؤقت |
| ------------------------------ | -----------: |
| Recommendation computation p50 | أقل من 100ms |
| Recommendation computation p95 | أقل من 250ms |
| Recommendation computation p99 | أقل من 500ms |
| Learner Home كاملًا warm p95   | أقل من 500ms |
| DB query منفردة غالبًا         | أقل من 200ms |

هذه أهداف هندسية مؤقتة تُراجع بعد Benchmark على البنية الفعلية، وليست أرقامًا عالمية ثابتة.

---

# 8. Event Instrumentation

## 8.1 RecommendationRequest

يمثل عملية إنشاء قائمة توصيات واحدة.

```text
RecommendationRequest
- id
- userId
- sessionId
- requestId
- surface
- sectionKey
- locale
- deviceType
- cityId
- areaId
- createdAt
- algorithmKey
- algorithmVersion
- experimentId
- experimentVariant
- requestContextJson
- totalLatencyMs
- fallbackUsed
- fallbackReason
```

## 8.2 RecommendationCandidateTrace

يُستخدم في Shadow Mode والتشخيص، وليس بالضرورة الاحتفاظ به للأبد لكل candidate.

```text
RecommendationCandidateTrace
- requestId
- itemType
- itemId
- candidateSource
- sourceRank
- sourceScore
- eligible
- exclusionReason
- preRankScore
- finalScore
- finalRank
- explanationCodes
```

يجب وضع retention policy لأن حجم هذا الجدول قد يصبح كبيرًا.

## 8.3 RecommendationImpression

يمثل عنصرًا أُرسل إلى الواجهة.

```text
RecommendationImpression
- id
- requestId
- userId
- itemType
- itemId
- surface
- sectionKey
- position
- algorithmKey
- algorithmVersion
- experimentId
- experimentVariant
- finalScore
- candidateSources
- explanationCodes
- renderedAt
- becameVisibleAt
- visibleDurationMs
- createdAt
```

## 8.4 RecommendationAction

```text
RecommendationAction
- id
- impressionId
- userId
- itemType
- itemId
- actionType
- actionValue
- occurredAt
- contextJson
```

`actionType` يشمل:

```text
OPEN
LIKE
UNLIKE
SAVE
UNSAVE
FOLLOW
HIDE
NOT_RELEVANT
RESERVATION_STARTED
RESERVATION_CREATED
RESERVATION_ACCEPTED
RESERVATION_CANCELLED
RESERVATION_COMPLETED
PROJECT_STARTED
PROJECT_COMPONENT_LINKED
PROJECT_COMPLETED
```

## 8.5 لماذا impression logging إلزامي؟

الـ click لا يعكس relevance فقط؛ موضع العنصر يؤثر في احتمالية رؤيته والضغط عليه. تدريب Learning-to-Rank مباشرة على clicks دون مراعاة exposure وposition bias قد ينتج model يعيد تعلم ترتيب النظام السابق بدل تعلم رغبة المستخدم.

---

# 9. Attribution Rules

لا ننسب كل تفاعل لاحق إلى recommendation بصورة عشوائية.

## 9.1 Direct Attribution

عندما يبدأ التفاعل من card موصى بها وتحمل `impressionId`.

مثال:

```text
Recommendation card
→ Open details
→ Start reservation
→ Reservation created
```

يُربط الحجز بـ impression.

## 9.2 Assisted Attribution

قد يرى المستخدم المادة في Home، ثم يعود إليها من Saved Materials.

يمكن الاحتفاظ بـ:

* Direct attribution.
* Assisted attribution.

ولا نخلط الاثنين في primary metric.

## 9.3 Attribution Window

قيمة مبدئية تحتاج دراسة:

* Opens/likes: خلال الجلسة أو 24 ساعة.
* Reservation creation: خلال 7 أيام.
* Reservation completion: يتبع الحجز المنسوب نفسه، حتى لو اكتمل لاحقًا.

---

# 10. Dataset Families

لن يكون لدينا Dataset واحدة لكل المسائل.

## 10.1 Dataset A — Human-Labeled Material Relevance

الغرض:

* تقييم taxonomy.
* component matching.
* lexical retrieval.
* semantic retrieval.
* project-to-material relevance.

### وحدة البيانات

```text
Query or requirement
Candidate material
Relevance label
Compatibility label
Reason
Reviewer
```

### أمثلة Queries

```text
"حساس لقياس المسافة"
"لوحة تحكم فيها Wi-Fi"
"خشب مناسب لصناعة رف"
"قماش مرن لحقيبة"
"12V 5A power adapter"
"HC-SR04"
```

### Relevance Grades

| الدرجة | المعنى                               |
| -----: | ------------------------------------ |
|      0 | غير متعلق أو غير مناسب               |
|      1 | مرتبط موضوعيًا، لكنه غير مفيد عمليًا |
|      2 | يمكن استخدامه بشروط أو كبديل ضعيف    |
|      3 | مناسب                                |
|      4 | مناسب جدًا أو مطابق مباشر            |

نفصل بين:

```text
Semantic relevance
Technical compatibility
```

قد تكون المادة دلاليًا قريبة لكنها غير متوافقة تقنيًا.

---

## 10.2 Dataset B — Temporal Interaction Dataset

الغرض:

* LightFM.
* ALS.
* Personalized scoring.
* Two-Tower لاحقًا.
* Ranking models لاحقًا.

يحتوي على:

```text
user
item
event
eventTime
impressionId
position
surface
context
item state at event time
user features at event time
```

## 10.3 Dataset C — Recommendation Request Groups

مطلوب لـ LambdaMART وLearning-to-Rank.

كل request يمثل group:

```text
QID 1001:
Material A label 0
Material B label 2
Material C label 4

QID 1002:
Material D label 1
Material E label 0
```

XGBoost Learning-to-Rank يتطلب grouping حسب query/request، ويستخدم graded أو binary relevance داخل كل group.

## 10.4 Dataset D — Synthetic Load Dataset

الغرض:

* query performance.
* pipeline throughput.
* memory.
* training duration.
* vector indexing.
* concurrency.
* failure tests.

لا يُستخدم كدليل أساسي على جودة personalization.

## 10.5 Dataset E — Controlled Preference Simulator

ننشئ personas ذات latent preferences معروفة.

يفيد في:

* فحص أن pipeline يعمل.
* اكتشاف أخطاء feature mapping.
* مقارنة قدرة الخوارزميات على استعادة signal مزروعة.
* اختبار sparse/dense scenarios.

لكن النتائج يجب وصفها بأنها:

```text
Simulation quality
```

وليس:

```text
Real-user recommendation quality
```

---

# 11. Temporal Splitting

## 11.1 المبدأ

يجب ألا يتدرب النموذج على أحداث أو عناصر لم تكن معروفة وقت التوصية.

الدراسات أظهرت أن ignoring global timeline يمكن أن يسبب data leakage ويغير ترتيب النماذج بصورة غير واقعية.

## 11.2 التقسيم الأساسي

مثال:

```text
Training:
كل الأحداث حتى 2026-09-30

Validation:
2026-10-01 إلى 2026-10-14

Test:
2026-10-15 إلى 2026-10-31
```

التواريخ الفعلية تعتمد على توفر البيانات.

## 11.3 قواعد Availability التاريخية

عند تقييم recommendation في وقت `T`:

* لا يجوز إدخال مادة أُنشئت بعد `T`.
* لا يجوز اعتبار مادة متاحة إذا كانت حالتها التاريخية غير مؤهلة وقت `T`.
* لا يجوز استخدام feature محسوبة من أحداث بعد `T`.
* لا يجوز استخدام popularity future counts.
* لا يجوز استخدام آخر حالة حالية بدل snapshot تاريخية.

## 11.4 Rolling Windows

لا نعتمد split واحدة فقط.

مثال:

```text
Window 1: train Jan–Mar, test Apr
Window 2: train Jan–Apr, test May
Window 3: train Jan–May, test Jun
```

يساعد ذلك على كشف نموذج نجح بالصدفة في فترة واحدة.

---

# 12. Evaluation Slices

النتيجة الإجمالية قد تخفي فشلًا خطيرًا داخل مجموعة معينة.

كل تجربة يجب أن تُعرض على الأقل حسب الشرائح التالية.

## 12.1 User Activity

```text
NEW_USER
LOW_ACTIVITY
MEDIUM_ACTIVITY
HIGH_ACTIVITY
```

تعريف الحدود يتم بعد رؤية توزيع التفاعلات الحقيقي.

## 12.2 Item Age

```text
NEW_ITEM
RECENT_ITEM
ESTABLISHED_ITEM
```

## 12.3 Cold Start Matrix

| المستخدم | المادة |
| -------- | ------ |
| جديد     | جديدة  |
| جديد     | قديمة  |
| نشط      | جديدة  |
| نشط      | قديمة  |

## 12.4 Language

```text
Arabic query → Arabic item
Arabic query → English item
English query → Arabic item
English query → English item
Mixed-language
```

## 12.5 Recommendation Intent

```text
General interest
Saved project
Active project
Specific component
Free preference
Nearby preference
Delivery-dependent
```

## 12.6 Geography

* نفس المنطقة.
* نفس المدينة.
* مدينة أخرى مع delivery.
* مدينة أخرى بلا delivery.
* لا يوجد موقع محفوظ.

## 12.7 Item Popularity

```text
Head items
Mid-tail
Long-tail
Zero-interaction items
```

## 12.8 Material Category

نقيس كل category بصورة مستقلة، لأن النجاح في Electronics لا يثبت النجاح في Fabric أو Wood.

---

# 13. Baselines

لا نختبر ML مقابل لا شيء.

## Baseline 0 — Random Eligible

ترتيب عشوائي للعناصر المؤهلة.

الغرض ليس الاستخدام، بل كشف أخطاء evaluation.

## Baseline 1 — Recent Eligible

الأحدث أولًا.

## Baseline 2 — Popular Eligible

الأكثر تفاعلًا ضمن نافذة زمنية.

يجب منع leakage باستخدام counts المتوفرة وقت التوصية فقط.

## Baseline 3 — Current Rule-Based Recommender

النظام الحالي بعد:

* إصلاح استعلاماته.
* تثبيت seed/benchmark.
* تطبيق الحدود داخل DB.
* تسجيل version للأوزان.

## Baseline 4 — Structured Knowledge

يعتمد على:

* interests.
* categories.
* component types.
* project requirements.
* location.
* eligibility.

## Baseline 5 — PostgreSQL Lexical Search

باستخدام exact matching وfull-text search عند الملاءمة.

## Baseline 6 — Semantic Retrieval

لا يصبح baseline دائمًا إلا بعد تنفيذ التجربة.

## Baseline 7 — LightFM

نجرب على الأقل:

```text
WARP
BPR
with identity features
with metadata
hybrid identity + metadata
```

LightFM يوفر Precision@K وRecall@K وAUC وReciprocal Rank، ويسمح باستبعاد train positives من evaluation حتى لا تُحسب إعادة توصية العناصر المعروفة نجاحًا جديدًا.

## Baseline 8 — Implicit ALS

Collaborative baseline مستقل عن LightFM.

## Challenger Models

لا تدخل قبل نجاح baselines:

```text
Two-Tower
LightGCN
LambdaMART
Deep ranking
Sequential models
```

---

# 14. Retrieval Metrics

## 14.1 Recall@K

من العناصر relevant المعروفة، كم عنصرًا ظهر ضمن أول K؟

```text
Recall@K =
Relevant items in top K
÷
All relevant items
```

نقيس:

```text
Recall@10
Recall@50
Recall@100
```

## 14.2 Hit Rate@K

هل ظهر relevant item واحد على الأقل في أول K؟

## 14.3 MRR

يعطي قيمة أكبر عندما يظهر أول relevant item في ترتيب مبكر.

```text
MRR = average(1 / rank of first relevant item)
```

## 14.4 Candidate Coverage

نسبة عناصر catalog المؤهلة التي يمكن للمصدر استرجاعها عبر الفترة.

## 14.5 New Item Recall

Recall محسوبة فقط للمواد التي لم تمتلك interactions تدريبية كافية.

---

# 15. Ranking Metrics

## 15.1 NDCG@K

المقياس الأساسي عندما تكون labels متعددة الدرجات:

```text
0, 1, 2, 3, 4
```

يعطي أهمية أكبر للعناصر relevant في أعلى القائمة.

XGBoost يوصي بـ `rank:ndcg` كخيار عام عندما تكون relevance binary أو متعددة المستويات، مع grouping حسب query.

نقيس:

```text
NDCG@5
NDCG@10
```

## 15.2 Precision@K

```text
عدد العناصر relevant في أول K
÷
K
```

## 15.3 Recall@K

مفيد عندما يوجد أكثر من عنصر صحيح للمستخدم.

## 15.4 MRR

مهم عندما نريد وصول أول مادة مفيدة مبكرًا.

---

# 16. Beyond-Accuracy Metrics

## 16.1 Catalog Coverage

ما نسبة المواد المؤهلة التي حصلت على ظهور خلال فترة؟

## 16.2 Supplier Coverage

ما نسبة الموردين المؤهلين الذين ظهرت لهم مادة واحدة على الأقل؟

## 16.3 Intra-List Diversity

مدى اختلاف عناصر القائمة عن بعضها حسب:

* category.
* component type.
* supplier.
* taxonomy.
* semantic similarity.

## 16.4 Novelty

هل النظام يعرض فقط العناصر التي يعرفها الجميع؟

## 16.5 Freshness

نسبة تمثيل العناصر الحديثة، مع عدم رفعها دون relevance.

## 16.6 Calibration

إذا كانت 70% من تفاعلات المستخدم Electronics و30% Woodworking، هل توصياته متناسبة بصورة معقولة، أم كلها Electronics؟

## 16.7 Project Requirement Coverage

كم نوعًا مختلفًا من المكونات الناقصة غطته القائمة؟

---

# 17. Statistical Evaluation

## 17.1 لا نعتمد متوسطًا واحدًا

يجب عرض:

* mean.
* median عند الملاءمة.
* 95% confidence interval.
* per-slice metrics.
* عدد المستخدمين والطلبات الداخلة في الحساب.

## 17.2 Paired Comparison

نقارن نموذجين على users أو request groups نفسها.

نستخدم:

* bootstrap confidence intervals.
* permutation test أو اختبار مناسب للـ paired data.
* multiple-run stability للنماذج العشوائية.

## 17.3 Seeds

أي model يعتمد random initialization يُدرب بأكثر من random seed.

لا نعتمد model لأنه فاز في run واحدة.

## 17.4 Learning Curves

ندرب على:

```text
20%
40%
60%
80%
100%
```

من بيانات التدريب.

الأسئلة:

* هل الأداء يتحسن مع زيادة البيانات؟
* هل النموذج وصل سقفًا؟
* هل Two-Tower يحتاج بيانات أكثر؟
* هل التباين مرتفع؟
* هل model أعقد يستفيد فعلًا من الحجم؟

---

# 18. Experiment E1 — Database Scalability

## الهدف

تحديد هل نحتاج candidate retrieval architecture أصلًا.

## Datasets

```text
1,000 materials
10,000 materials
50,000 materials
100,000 materials
```

مع interactions وعلاقات واقعية في الحجم.

## الاختبارات

1. Eligibility query.
2. Current structured candidate query.
3. Full eligible scoring.
4. Project-component retrieval.
5. Behavior context loading.
6. Concurrent Home requests.

## المقاييس

* p50/p95/p99.
* rows scanned.
* rows returned.
* index usage.
* buffer hits/reads.
* query count.
* memory.
* throughput.
* pool wait time.

## قرار النجاح

إذا استطعنا filter وscore كل eligible materials ضمن SLO، لا نضيف ANN retrieval لمجرد أنه معماريًا شائع.

## بوابة Two-Tower/ANN

نبدأ Two-Tower كحل scale فقط إذا أثبت الاختبار أن full eligible scoring:

* يخترق latency budget.
* يستهلك CPU غير مقبول.
* لا يتوسع مع catalog المستهدف.
* أو كان Two-Tower يحقق جودة أفضل مثبتة وليس سرعة فقط.

---

# 19. Experiment E2 — Structured Taxonomy

## الهدف

إثبات أن normalization يحسن مطابقة الاهتمامات والمشاريع.

## المقارنة

```text
Current category/tag matching
vs
Typed taxonomy
vs
Typed taxonomy + aliases
vs
Typed taxonomy + compatibility rules
```

## Dataset

Human-labeled material relevance dataset.

## Metrics

* Recall@10/50.
* NDCG@10.
* exact component match rate.
* incompatible match rate.
* unclassified material rate.

## بوابة القبول

يجب أن:

* ترفع component recall.
* تقلل lost mappings.
* تقلل الاعتماد على substring matching.
* لا تزيد incompatible matches.

Typed taxonomy متطلب domain حتى لو لم تُستخدم ML، لذلك معيار قبولها يشمل data quality وليس ranking فقط.

---

# 20. Experiment E3 — Semantic Text Retrieval

## الهدف

معرفة هل semantic retrieval يضيف candidates صحيحة لا يجدها lexical/structured retrieval.

## Models

نختار مجموعة multilingual models بعد benchmark تقني مستقل.

لا نثبت اسم نموذج قبل التجربة.

## المقارنة

```text
Exact/keyword
PostgreSQL full-text
Structured taxonomy
Dense semantic
Lexical + dense
Structured + lexical + dense
```

PostgreSQL يدعم full-text search مع `tsvector` و`tsquery` وGIN indexes، ولذلك يجب أن يكون baseline حقيقيًا قبل إدخال vector database.

## ملاحظة

المصدر السابق يخص temporal leakage وليس PostgreSQL؛ المرجع المعتمد لتنفيذ FTS يجب أن يكون توثيق PostgreSQL الرسمي أثناء مرحلة التنفيذ.

## Test Slices

* Arabic paraphrase.
* English paraphrase.
* Cross-language.
* Mixed language.
* Exact part number.
* Typo.
* Use-case query.
* Same-category hard negatives.
* Technically incompatible semantic neighbors.

## بوابة القبول المقترحة

يُقبل Semantic Retrieval فقط إذا:

1. رفع Recall@50 على الـ paraphrase/cross-language slices.
2. حافظ على exact-part-number quality.
3. لم يرفع incompatible top-10 rate بما يتجاوز guardrail.
4. أضاف relevant unique candidates ليست موجودة في structured/lexical.
5. حقق latency وmemory مقبولين.
6. نجح على أكثر من random sample أو reviewer subset.

## قرار Vector Store

لا نختار Qdrant أو pgvector قبل مقارنة:

```text
exact embedding search
pgvector
Qdrant
```

على corpus وفلاتر ImpactLoop.

---

# 21. Experiment E4 — LightFM and ALS

## الهدف

معرفة هل collaborative behavior يضيف personalization فوق structured baseline.

## Models

```text
LightFM WARP
LightFM BPR
LightFM identity-only
LightFM metadata-only
LightFM hybrid
Implicit ALS
```

## Features

User:

* explicit interests.
* city/area.
* free preference.
* delivery preference.

Item:

* category.
* material type.
* taxonomy nodes.
* price/free.
* delivery.
* location buckets.
* use cases.
* component capabilities.

## Interaction Variants

لا نفترض weights نهائية.

نجرب:

### Binary

```text
positive interaction = 1
```

### Weighted

مثال تجريبي:

```text
view = 0.2
like = 1
save = 1.5
reservation created = 3
reservation completed = 5
```

### Strong-only

يستبعد المشاهدات ويستخدم:

* likes.
* saves.
* reservations.
* completions.

## بوابة القبول

لا يكفي أن يفوز في AUC.

يجب أن:

* يتفوق على current/structured baseline في NDCG أو Recall relevant للسطح.
* يحسن active-user slices.
* لا ينهار في new-user/new-item slices.
* يضيف catalog coverage.
* يبقى مستقرًا عبر seeds.
* لا يعتمد نجاحه على synthetic interactions فقط.

---

# 22. Experiment E5 — Two-Tower Readiness

لا يبدأ هذا الاختبار قبل:

* بيانات interactions حقيقية كافية.
* Baselines مستقرة.
* Dataset versioned.
* Temporal split صحيح.
* Candidate retrieval أو personalization gap مثبت.

## المقارنة

```text
LightFM hybrid
ALS
Structured + behavior scorer
Two-Tower
```

## Metrics

* Recall@50/100.
* Cold-start recall.
* Head/mid/tail recall.
* Training stability.
* Inference latency.
* Item embedding refresh time.
* ANN recall مقابل exact scoring.

## بوابة القبول

Two-Tower يدخل النظام فقط إذا:

* حقق تحسنًا ذا دلالة على أكثر من slice.
* لم يكن تحسنه محصورًا في users ذوي interactions كثيرة فقط.
* حقق SLO.
* برر كلفة serving والـ embeddings والـ index.
* تفوق على full-scoring baseline في الجودة أو التوسع.

---

# 23. Experiment E6 — Learned Ranker

لا يبدأ production ranking training قبل وجود request-grouped impressions.

## Models

```text
Weighted deterministic score
Pointwise logistic/GBDT
XGBoost LambdaMART
LightGBM ranker
```

## Labels

نختبر أكثر من تعريف:

### Binary

```text
0 = no meaningful action
1 = meaningful action
```

### Graded

```text
0 = visible, no action
1 = open
2 = like/save
3 = reservation started
4 = reservation created
5 = reservation completed
```

لا نفترض أن هذه الدرجات نهائية قبل sensitivity analysis.

## Position Bias

Clicks وactions تتأثر بموضع العنصر. XGBoost يوفر خيارًا تجريبيًا لـ position-debiased LambdaMART، لكن توثيقه نفسه يوضح أن المجال ما زال بحثيًا وأن clicks noisy ومنحازة.

لذلك نحتاج:

* position feature.
* visible impressions لا rendered فقط.
* controlled exploration data.
* propensity أو debiasing experiment.
* مقارنة unbiased/standard training.

## بوابة القبول

Ranker يدخل Shadow Mode فقط إذا:

* تفوق offline على deterministic score.
* لم يخرق cold-start slices.
* latency ضمن الميزانية.
* feature generation point-in-time correct.
* لا توجد leakage.
* يمكن تفسير أهم features.
* يمكن الرجوع إلى baseline فورًا.

---

# 24. Offline Promotion Rules

تقنية جديدة لا تتقدم إلا إذا اجتازت جميع الأنواع التالية.

## 24.1 Quality Gate

تحسن واضح في metric الأساسية الخاصة بالمهمة.

## 24.2 Slice Gate

لا يوجد تراجع كبير غير مقبول في:

* new users.
* new items.
* Arabic/cross-language.
* location-constrained users.
* categories الرئيسية.

## 24.3 Eligibility Gate

لا تغير صلاحية العناصر أو تتجاوز constraints.

## 24.4 Performance Gate

p95 وp99 ضمن الحدود.

## 24.5 Stability Gate

التحسن مستقر عبر:

* عدة seeds.
* أكثر من temporal window.
* أكثر من dataset size.

## 24.6 Complexity Gate

يجب توثيق:

* خدمة جديدة.
* storage جديد.
* worker جديد.
* deployment cost.
* failure modes.
* maintenance burden.

تقنية تحسن NDCG بـ0.2% وتضيف خدمة وفهرسًا ومزامنة كاملة قد تُرفض.

---

# 25. Shadow Mode

في Shadow Mode:

```text
المستخدم يرى النظام الحالي
لكن النظام الجديد يحسب نتائجه في الخلفية
```

نسجل:

* top-K الجديد.
* overlap مع النظام الحالي.
* eligible invalid results.
* latency.
* source contribution.
* score distribution.
* fallback behavior.

لا نعرض النتائج الجديدة للمستخدم.

## Shadow Metrics

```text
Top-K overlap
Unique relevant candidates
Invalid candidate rate
Latency
Coverage
Diversity
Failure rate
```

---

# 26. Canary Rollout

بعد نجاح Shadow Mode:

```text
1% users
→ 5%
→ 10%
→ 25%
→ 50%
→ 100%
```

النسب ليست إلزامية حرفيًا، لكن الانتقال تدريجي.

## Stop Conditions

إيقاف أو rollback عند:

* ارتفاع 5xx.
* latency breach.
* eligibility violation.
* reservation cancellation increase.
* significant guardrail deterioration.
* unavailable-material complaints.
* model/index version mismatch.

---

# 27. Online A/B Testing

## Assignment

المستخدم يبقى في variant ثابتة خلال التجربة.

```text
hash(userId, experimentId)
```

## Primary Outcome

حسب السطح:

* Successful reuse.
* Reservation completion.
* Component fulfillment.

## Secondary

* Open.
* Like/save.
* Reservation created.
* Time to useful action.

## Guardrails

* latency.
* cancellation.
* invalid availability.
* supplier concentration.
* diversity.
* error rate.

## مدة التجربة

لا تُحدد عشوائيًا بعدد أيام ثابت.

تعتمد على:

* حجم traffic.
* baseline rate.
* minimum detectable effect.
* delayed conversions.
* seasonality.

---

# 28. Data Quality Requirements

قبل كل training run يجب فحص:

## 28.1 Uniqueness

* لا يوجد duplicate impression ID.
* لا يوجد duplicate action event غير مبرر.
* Idempotency keys صحيحة.

## 28.2 Completeness

* userId أو anonymous/session rules.
* itemId.
* eventTime.
* model version.
* position.
* surface.
* item state.

## 28.3 Referential Integrity

* impression يشير إلى request صحيح.
* action يشير إلى impression صحيح عند direct attribution.
* material/project exists تاريخيًا.

## 28.4 Temporal Correctness

```text
actionTime >= impressionTime
featureTime <= predictionTime
itemCreatedAt <= predictionTime
```

## 28.5 Distribution Monitoring

نراقب:

* events per user.
* events per item.
* categories.
* cities.
* source distribution.
* positive rate.
* position distribution.
* model version share.

## 28.6 Synthetic/Real Separation

كل event يحتاج source:

```text
REAL
SYNTHETIC
TEST
LOAD_TEST
```

يُمنع دخول synthetic data في production-quality training dataset دون تصريح صريح.

---

# 29. Reproducibility Requirements

كل experiment يجب أن يسجل:

```text
experimentId
git commit
dataset version
cutoff dates
feature version
taxonomy version
model type
hyperparameters
random seed
library versions
training duration
hardware
metrics
slice metrics
artifact path
```

## Dataset Version

يمكن أن يكون:

```text
recommendation-materials-2026-10-31-v3
```

مع:

* query hash.
* extraction code version.
* schema version.
* row counts.
* time boundaries.
* quality report.

---

# 30. Model Decision Card

كل model مرشح يجب أن ينتج بطاقة:

```text
Model:
Version:
Purpose:
Training range:
Validation range:
Test range:
Features:
Labels:
Baselines:
Overall metrics:
Cold-start metrics:
Language metrics:
Category metrics:
Latency:
Memory:
Known failures:
Operational dependencies:
Promotion decision:
Decision rationale:
```

---

# 31. Final Technology Status

| التقنية                         | الحالة                    |
| ------------------------------- | ------------------------- |
| Current rule scorer             | Baseline إلزامي           |
| DB query optimization           | مطلوب فورًا               |
| Impression logging              | مطلوب فورًا               |
| Typed taxonomy                  | مطلوب                     |
| Generic knowledge graph         | غير مثبت                  |
| PostgreSQL lexical search       | Baseline مطلوب            |
| Semantic retrieval              | Experiment                |
| LightFM                         | Experiment/Baseline       |
| Implicit ALS                    | Experiment/Baseline       |
| Two-Tower                       | مشروط بالأدلة             |
| LambdaMART                      | مشروط ببيانات impressions |
| Qdrant                          | مشروط بBenchmark          |
| pgvector                        | مشروط بBenchmark          |
| Redis online features           | مشروط بالحاجة             |
| Separate recommendation service | مشروط بـ online ML        |
| Image/multimodal retrieval      | خارج النطاق الحالي        |
| Deep ranker                     | مؤجل                      |
| Sequential model                | مؤجل                      |
| Contextual bandit               | مؤجل                      |

---

# 32. ترتيب التنفيذ الرسمي

## Phase 0 — Fix Current Performance

1. تشخيص slow queries.
2. تطبيق `WHERE/ORDER/LIMIT` داخل SQL.
3. إزالة unbounded includes.
4. إضافة indexes بناءً على query plans.
5. قياس warm/cold/concurrency.
6. تثبيت performance baseline.

## Phase 1 — Recommendation Event Schema

1. RecommendationRequest.
2. RecommendationImpression.
3. RecommendationAction.
4. Attribution.
5. Model/version fields.
6. Synthetic/real source.
7. Retention rules.
8. Privacy review.
9. Integration tests.

## Phase 2 — Baseline Versioning

1. تحويل أوزان النظام الحالي إلى versioned configuration.
2. تسجيل explanation codes.
3. تسجيل candidate source.
4. حفظ benchmark outputs.
5. إضافة deterministic tests.

## Phase 3 — Typed Taxonomy

1. Audit categories/interests/components.
2. تعريف canonical taxonomy.
3. Arabic/English aliases.
4. Component types.
5. Compatibility/substitution.
6. Migration.
7. Admin validation tools.
8. Data quality report.

## Phase 4 — Human Relevance Dataset

1. تعريف labeling guide.
2. جمع queries/components.
3. توليد candidate pools.
4. تقييم بشري.
5. disagreement resolution.
6. حفظ dataset version.
7. بناء retrieval evaluation script.

## Phase 5 — Retrieval Baselines

1. Current matching.
2. Structured taxonomy.
3. PostgreSQL lexical/full-text.
4. Semantic experiment.
5. Hybrid combinations.
6. Latency benchmark.
7. Error analysis.

## Phase 6 — Collaborative Baselines

1. Temporal interaction extraction.
2. LightFM.
3. ALS.
4. Weighted/unweighted variants.
5. Cold-start evaluation.
6. Stability and learning curves.

## Phase 7 — Architecture Decision

بعد نتائج المراحل السابقة نقرر رسميًا:

* هل semantic retrieval يبقى؟
* هل نحتاج vector store؟
* هل LightFM/ALS يضيفان قيمة؟
* هل full scoring كافٍ؟
* هل Two-Tower مبرر؟
* هل online service مطلوبة؟

## Phase 8 — Learned Ranking Readiness

يبدأ بعد توفر impressions حقيقية كافية.

---

# 33. أول بوابات قبول عملية

## Current Performance Gate

```text
Learner Home noncached p95 <= 700ms مبدئيًا
No single unexplained query > 300ms
No unbounded candidate relation loads
Concurrent load does not cause catastrophic degradation
```

## Instrumentation Gate

```text
>= 99.9% of recommendation responses have request records
>= 99% of rendered cards have impression linkage
Direct actions link to impression when started from recommendation
No duplicate action events after idempotency handling
Synthetic events excluded by default
```

## Taxonomy Gate

```text
>= 95% of available materials mapped to valid primary category
>= 90% mapped to at least one useful component/use-case node where applicable
No invalid interest/category aliases silently discarded
Human-reviewed component matching improves over current baseline
```

## Semantic Gate

لا نضع رقم تحسن نهائي قبل إنشاء dataset، لكن مبدئيًا:

```text
Meaningful Recall@50 improvement on paraphrase/cross-language slices
No unacceptable exact-part-number regression
Low incompatible top-K rate
Latency within agreed budget
```

## Collaborative Gate

```text
Outperforms popularity and current rule baseline on real temporal data
Stable across windows and seeds
No serious cold-start regression
Adds personalization beyond global popularity
```

## Learned Ranker Gate

```text
Request-grouped data exists
Position/exposure data exists
Point-in-time features validated
Offline improvement is stable
Shadow Mode passes
Online guardrails remain healthy
```

---

# 34. القرارات المثبتة بعد هذه المواصفة

1. لا نختار الخوارزمية النهائية الآن.
2. نصلح الأداء الحالي أولًا.
3. نسجل recommendation exposure قبل تدريب ranker.
4. نبني typed taxonomy بدل generic graph واسع.
5. نقارن Semantic Retrieval بدل افتراض ضرورته.
6. نستخدم LightFM وALS كـ baselines تجريبية.
7. لا نبني Two-Tower قبل إثبات الحاجة.
8. لا نبني LambdaMART قبل request-grouped impressions.
9. لا نختار Qdrant قبل vector-store benchmark.
10. لا نستخدم synthetic seed لإثبات جودة المستخدم الحقيقي.
11. نقيس cold start واللغات والتصنيفات بصورة منفصلة.
12. لا يُعتمد model من Offline Metrics فقط.
13. Successful reuse وreservation completion أهم من clicks.
14. Hard business constraints تبقى خارج ML.
15. أي تعقيد جديد يجب أن يبرر نفسه بجودة أو أداء مثبتين.

---

# 35. المخرج المطلوب من كل مرحلة

كل مرحلة تنتهي بأحد القرارات التالية:

```text
ADOPT
ADOPT WITH CONDITIONS
CONTINUE EXPERIMENT
DEFER
REJECT
```

ولا تنتهي بعبارة:

```text
Implementation completed
```

المعيار ليس انتهاء الكود، بل وجود دليل على أن التغيير أفضل وآمن وقابل للتشغيل.
