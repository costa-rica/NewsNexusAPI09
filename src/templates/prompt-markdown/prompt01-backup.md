# Prompt 01

## Context

I am working on a project that looks at consumer products that are hazardous to consumers either through health, injury, or death.

I would like you to read the following article title and abstract and tell indicate if this is relevant to what we are looking for and if
the event occurred in the United States.

Here are some key words on the types of events and hazards we're looking for:
consumer product safety
cpsc safety alert
hazardous product warning
defective product injury
product-related accident
home safety hazards
home safety
child injury product
fire hazard consumer product
electric shock incident
poisoning household product
carbon monoxide poisoning product
burn injury consumer product
burn injury
choking hazard
laceration product defect
mechanical failure injury
mechanical injury
electrical appliance fire
sports equipment injury
toxic household chemicals
playground equipment accident
electrical fire
playground accident
toxic chemical

## Response Format

The response should be a JSON object with the following format:

```json
{
  "product": "product_name",
  "state": "state_name",
  "hazard": "hazard_name",
  "relevance_score": "score",
  "united_states_score": "score"
}
```

- example response:

```json
{
  "product": "ATV",
  "state": "California",
  "hazard": "Carbon monoxide poisoning",
  "relevance_score": 10,
  "united_states_score": 10
}
```

### Product

The product name should be a single word or phrase that best describes the product. If the product is not mentioned, return "No product mentioned".

### State

The state name should be the name of the state where the event occurred. If the state is not mentioned, return "No state mentioned".

### Hazard

The hazard name should be a single word or phrase that best describes the hazard. If the hazard is not mentioned, return "No hazard mentioned".

### Scores

Both Relevance score and United States score range from 0 to 10, where 0 is definitely not relevant/in the US, 5 is uncertain, and 10 is highly relevant/in the US.

## Article

### Article Title

<< article_title >>

### Article Abstract

<< article_abstract >>

### Article Content

<< article_scraped_content >>
