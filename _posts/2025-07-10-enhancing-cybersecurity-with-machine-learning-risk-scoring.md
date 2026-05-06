---
layout: post
title: "Enhancing Cybersecurity with Machine Learning Risk Scoring"
date: 2025-07-10 00:32:49
categories: [AI]
tags: [artificial-intelligence, books, CYBERSECURITY, technology]
slug: enhancing-cybersecurity-with-machine-learning-risk-scoring
---
<!-- wp:image {"id":174,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://xplorertech00.wordpress.com/wp-content/uploads/2025/07/gemini_generated_image_fwj36fwj36fwj36f.png?w=1024" alt="" class="wp-image-174" /></figure>
<!-- /wp:image -->

<!-- wp:image -->
<figure class="wp-block-image"><img alt="" /></figure>
<!-- /wp:image -->

<!-- wp:paragraph -->
<p>In the evolving battlefield of cybersecurity, detecting threats is no longer enough. Security Operations Centers (SOCs) face <strong>alert fatigue</strong>, drowning in a sea of notifications. The real challenge? <strong>Prioritizing which threats matter most</strong>.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>What if we could use Machine Learning not just to detect attacks — but to <strong>score them by severity</strong>, helping defenders focus on what matters?</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Welcome to my project:<br>🧠 <strong>Network Anomaly Risk Scorer</strong> — a machine learning pipeline that predicts the <strong>severity of cyber threats</strong> from raw network data.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🎯 Project Goal</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Instead of classifying traffic as just <em>malicious</em> or <em>benign</em>, this project answers:</p>
<!-- /wp:paragraph -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p><strong>"How dangerous is this activity?"</strong></p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:paragraph -->
<p>We use regression models to assign a <strong>numeric severity score (0 to 10)</strong> to every network event. Think of it as giving each connection an "urgency rating" — much like a medical triage system.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🧬 Dataset: UNSW-NB15</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We used the <a>UNSW-NB15 dataset</a> — a comprehensive capture of real and synthetic attacks including:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>DDoS</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Shellcode</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Exploits</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Reconnaissance</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Fuzzers</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>and normal traffic</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Each event includes 45+ features like:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Protocol, service, state</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Bytes sent/received</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>TCP flags</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Flow duration</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>To make the problem more real-world, we created a custom <strong>severity mapping</strong> based on attack types and network patterns.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🛠️ Workflow Overview</h2>
<!-- /wp:heading -->

<!-- wp:preformatted -->
<pre class="wp-block-preformatted">textCopyEdit<code>Raw Logs → Preprocessing → Severity Mapping → Regression Model → Risk Score
</code></pre>
<!-- /wp:preformatted -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Modules</h3>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>📁 <code>src/risk_score_mapping.py</code>: Assigns numerical severity to each attack type</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>📁 <code>src/data_preprocessing.py</code>: Scales and encodes raw features</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>📁 <code>src/model_training.py</code>: Trains Random Forest/XGBoost models</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>📁 <code>src/interpretability.py</code>: Uses SHAP for transparent predictions</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>📁 <code>app/streamlit_visualizer.py</code>: Real-time scoring dashboard</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🧠 First-Principle Thinking</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>What makes an activity <em>more dangerous</em>?</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>We engineered severity based on:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Attack type (SQL injection > Reconnaissance)</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Duration of connection</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Bytes exchanged</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Number of destination IPs</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>This prioritization mimics real-world triage logic inside SOCs.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">📊 Model Results</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Using <code>RandomForestRegressor</code>, we achieved:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>MAE</strong>: 0.71</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>RMSE</strong>: 1.13</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>R² Score</strong>: 0.89</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>This means our model predicts the <strong>threat intensity</strong> quite accurately on unseen traffic.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🧠 Explainability with SHAP</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Security teams need transparency.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>We integrated <strong>SHAP (SHapley Additive Explanations)</strong> to visualize:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Which features most increased/decreased the predicted severity</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Global feature importance (e.g., flow duration, bytes, TCP flags)</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Beeswarm plots and bar charts make these insights accessible to analysts and decision-makers alike.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🌐 Streamlit Dashboard</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We built a real-time UI where users can:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Upload live or historical traffic logs</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Get predicted severity scores</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Visualize what influenced each score</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:preformatted -->
<pre class="wp-block-preformatted">bashCopyEdit<code>streamlit run app/streamlit_visualizer.py
</code></pre>
<!-- /wp:preformatted -->

<!-- wp:paragraph -->
<p>Future goal: connect to <strong>live packet sniffers</strong> or <strong>cloud logs</strong> for instant triage.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">🧠 Why This Matters</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Most ML security projects stop at <em>detection</em>.<br>But in reality, defenders need <strong>context + priority</strong>.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>This project empowers:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Faster <strong>alert triage</strong></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Resource-saving <strong>automation</strong></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Transparent <strong>explanations for every score</strong></li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity" />
<!-- /wp:separator -->

<!-- wp:heading -->
<h2 class="wp-block-heading">📌 Final Thoughts</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>This project isn't just about code — it’s about redefining <strong>how AI assists cybersecurity</strong>:</p>
<!-- /wp:paragraph -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>From <strong>black-box alerts</strong> → to <strong>clear, explainable risk scores</strong>.</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:paragraph -->
<p>The full code is available on GitHub:<br>🔗 <a href="https://github.com/Anandhasasidharan/projects">https://github.com/Anandhasasidharan/projects</a></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>check my Youtube channel for explanation </p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="https://www.youtube.com/@XplorerTech">https://www.youtube.com/@XplorerTech</a></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>REACH OUT </p>
<!-- /wp:paragraph -->

<!-- wp:embed {"url":"https://twitter.com/XplorerTech00","type":"rich","providerNameSlug":"twitter","responsive":true} -->
<figure class="wp-block-embed is-type-rich is-provider-twitter wp-block-embed-twitter"><div class="wp-block-embed__wrapper">
https://twitter.com/XplorerTech00
</div></figure>
<!-- /wp:embed -->

<!-- wp:paragraph -->
<p></p>
<!-- /wp:paragraph -->