# **App Name**: Google Maps Scraper

## Core Features:

- Google Maps Search: Search for companies on Google Maps based on industry, city, and optional neighborhood.
- Data Extraction: Extract all available data for each business, including Name, Location, WhatsApp (if available), Industry, Social Media links (if available), Website (if available), and Ratings.
- Results Review: Display the search results in a list format for the user to review. The user should be able to view detailed information for each business.
- Company Deletion: Allow the user to manually delete companies from the search results before saving to the Firestore database.
- Data Enrichment Tool: Use a tool to find additional info and fill empty data for any listing by searching the web based on company name.
- Save to Firestore: Save the reviewed and filtered company data to a Firestore database.

## Style Guidelines:

- Primary color: A saturated blue (#29ABE2), echoing Google Maps' brand identity and conveying reliability.
- Background color: Light gray (#F5F5F5), provides a clean, neutral backdrop.
- Accent color: A vivid green (#90EE90) to indicate positive actions or available links, analogous to blue and highly contrasting on gray.
- Font: 'Inter', a grotesque-style sans-serif for both headlines and body, ensuring a modern, machined look and legibility.
- Use simple, clear icons from a library like Material Icons to represent data types (location, phone, website, etc.).
- Maintain a clean, list-based layout for search results, with clear separation between entries.
- Use subtle animations for loading states and data transitions to provide feedback without being intrusive.