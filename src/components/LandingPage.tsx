import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  Search,
  TrendingUp,
  Home,
  BarChart3,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Separator } from "./ui/separator";
import { PropertyCard } from "./PropertyCard";
import { Property } from "../types/property";
import { matchesPropertyQuery, normalizeSearchText } from "../utils/propertySearch";
import { formatIndianPriceReadable } from "../utils/indianNumberFormat";
import { useFormattedStats } from "../hooks/usePropertyStats";

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  isLoggedIn?: boolean;
  properties: Property[];
  isLoading?: boolean;
  favoriteIds: Set<string>;
  compareIds: Set<string>;
  toggleFavorite?: (id: string) => void;
  toggleCompare?: (id: string) => void;
}

export function LandingPage({
  onGetStarted,
  onLogin,
  isLoggedIn = false,
  properties,
  isLoading = false,
  favoriteIds,
  compareIds,
  toggleFavorite,
  toggleCompare,
}: LandingPageProps) {
  const MAX_PRICE = 90000000;
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("price-asc");
  const [showSearch, setShowSearch] = useState(false);
  const [currentHeroImage, setCurrentHeroImage] = useState(0);
  const [currentFeaturedProperty, setCurrentFeaturedProperty] = useState(0);

  // Hero carousel images
  const heroImages = [
    "https://images.unsplash.com/photo-1679364297777-1db77b6199be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMGV4dGVyaW9yfGVufDF8fHx8MTc2NDgwMzk3M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1594873604892-b599f847e859?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcGFydG1lbnQlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NjQ3OTIyOTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1566908829550-e6551b00979b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dGlmdWwlMjBob3VzZSUyMGFyY2hpdGVjdHVyZXxlbnwxfHx8fDE3NjQ3NjAwNjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBob21lJTIwZGVzaWdufGVufDF8fHx8MTc2NDc1OTU5Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1571654443889-863482ff3f42?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBob3VzZXxlbnwxfHx8fDE3NjQwNzI4NTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  ];

  // Auto-advance hero carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Compute top 10 featured properties by appreciation rate
  const featuredProperties = [...properties]
    .sort((a, b) => b.appreciationRate - a.appreciationRate)
    .slice(0, 10);

  // Auto-advance featured properties carousel
  useEffect(() => {
    if (featuredProperties.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedProperty((prev) => (prev + 1) % featuredProperties.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredProperties.length]);

  useEffect(() => {
    if (currentFeaturedProperty >= featuredProperties.length) {
      setCurrentFeaturedProperty(0);
    }
  }, [featuredProperties.length, currentFeaturedProperty]);

  // Advanced filters
  const [priceRange, setPriceRange] = useState<number[]>([0, MAX_PRICE]);
  const [bedroomFilter, setBedroomFilter] = useState<string>("all");
  const [bathroomFilter, setBathroomFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [bhkFilter, setBhkFilter] = useState<string>("all");

  const clearFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setSortBy("price-asc");
    setPriceRange([0, MAX_PRICE]);
    setBedroomFilter("all");
    setBathroomFilter("all");
    setCityFilter("all");
    setBhkFilter("all");
  };

  const filteredProperties = properties
    .filter((property) => {
      const normalizedQuery = normalizeSearchText(searchQuery);
      const matchesPrimary = matchesPropertyQuery(searchQuery, [
        property.title,
        property.location,
        property.city,
      ]);
      const matchesDescription =
        normalizedQuery.length > 0 &&
        normalizeSearchText(property.description).includes(normalizedQuery);
      const matchesSearch = matchesPrimary || matchesDescription;
      const matchesType = filterType === "all" || property.propertyType === filterType;
      const matchesPrice =
        property.currentPrice >= priceRange[0] && property.currentPrice <= priceRange[1];
      const matchesBedrooms =
        bedroomFilter === "all" || property.bedrooms >= parseInt(bedroomFilter);
      const matchesBathrooms =
        bathroomFilter === "all" || property.bathrooms >= parseInt(bathroomFilter);
      const matchesCity = cityFilter === "all" || property.city === cityFilter;
      const matchesBHK = bhkFilter === "all" || property.bhkType === bhkFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesPrice &&
        matchesBedrooms &&
        matchesBathrooms &&
        matchesCity &&
        matchesBHK
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.currentPrice - b.currentPrice;
        case "price-desc":
          return b.currentPrice - a.currentPrice;
        case "appreciation":
          return b.appreciationRate - a.appreciationRate;
        default:
          return 0;
      }
    });

  // Get formatted stats that update automatically
  const stats = useFormattedStats(filteredProperties);

  const hasActiveFilters =
    searchQuery ||
    filterType !== "all" ||
    bedroomFilter !== "all" ||
    bathroomFilter !== "all" ||
    priceRange[0] !== 0 ||
    priceRange[1] !== MAX_PRICE ||
    cityFilter !== "all" ||
    bhkFilter !== "all";

  const uniqueCities = Array.from(new Set(properties.map((p) => p.city))).sort();
  const featuredProperty = featuredProperties[currentFeaturedProperty] ?? null;

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black -mx-4 -mt-4 md:-mx-6 md:-mt-6 px-0 min-h-[450px] md:min-h-[600px]">
        {/* Carousel Behind Logo */}
        <div className="absolute inset-0">
          {/* Carousel Images */}
          {heroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentHeroImage ? "opacity-100" : "opacity-0"
              }`}
            >
              <ImageWithFallback
                src={image}
                alt={`Property ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {/* Dark overlay for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80"></div>
        </div>
        
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-800 rounded-xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-red-600 to-red-800 p-4 rounded-xl shadow-xl">
                  <Home className="w-10 h-10 text-white" />
                  <TrendingUp className="w-5 h-5 text-white absolute -bottom-1 -right-1" />
                </div>
              </div>
              <div className="flex items-baseline leading-none">
                <span className="text-6xl font-bold text-red-600">BRO</span>
                <span className="text-6xl text-white">kar</span>
              </div>
            </div>

            {/* Tagline */}
            <div className="space-y-4">
              <h1 className="text-white drop-shadow-2xl">Predict Your Property's Future Value</h1>
              <p className="text-xl text-white drop-shadow-lg max-w-2xl mx-auto">
                Make smarter real estate investments with AI-powered price predictions.
                Visualize how property values will grow over the next 10 years.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => {
                  setShowSearch(true);
                  setTimeout(() => {
                    document
                      .getElementById("property-search")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-xl"
              >
                <Search className="w-5 h-5" />
                Search Properties
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={isLoggedIn ? undefined : onGetStarted}
                disabled={isLoggedIn}
                className="gap-2 bg-white hover:bg-gray-100 shadow-xl"
              >
                {isLoggedIn ? "Already logged in!" : (
                  <>
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2>Why Choose BROkar?</h2>
            <p className="text-muted-foreground mt-2">
              Powerful features to help you make informed property decisions
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="text-center space-y-4 p-6 border rounded-lg bg-card hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20">
                <TrendingUp className="w-8 h-8 text-red-600" />
              </div>
              <h3>AI-Powered Predictions</h3>
              <p className="text-muted-foreground">
                Advanced algorithms analyze market trends to predict property values up to 10
                years into the future.
              </p>
            </div>

            <div className="text-center space-y-4 p-6 border rounded-lg bg-card hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <h3>Interactive Comparisons</h3>
              <p className="text-muted-foreground">
                Compare up to 4 properties side-by-side to find the best investment
                opportunity for your portfolio.
              </p>
            </div>

            <div className="text-center space-y-4 p-6 border rounded-lg bg-card hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <h3>Real-Time Market Data</h3>
              <p className="text-muted-foreground">
                Access up-to-date market information and historical appreciation rates to
                make data-driven decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Carousel */}
      <section className="py-16 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2>Featured Properties</h2>
            <p className="text-muted-foreground mt-2">
              Discover our hand-picked premium properties with high appreciation potential
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative h-[260px] sm:h-[380px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl group">
              {/* Carousel Images */}
              {featuredProperties.map((property, index) => {
                const images = property.images || [property.imageUrl];
                return (
                  <div
                    key={property.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      index === currentFeaturedProperty ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <ImageWithFallback
                      src={images[0]}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}

              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

              {/* Property Info */}
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                {featuredProperty ? (
                  <>
                    <div className="flex gap-3 mb-4">
                      <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                        {featuredProperty.propertyType}
                      </Badge>
                      <Badge className="bg-red-600 text-white">
                        {featuredProperty.bhkType}
                      </Badge>
                      <Badge className="bg-green-600 text-white">
                        {featuredProperty.appreciationRate}% Growth
                      </Badge>
                    </div>
                    <h3 className="text-white text-3xl mb-2">{featuredProperty.title}</h3>
                    <p className="text-white/90 text-lg mb-4">{featuredProperty.location}</p>
                    <div className="flex gap-6 mb-4">
                      <span className="text-white/80">{featuredProperty.bedrooms} Bedrooms</span>
                      <span className="text-white/80">{featuredProperty.bathrooms} Bathrooms</span>
                      <span className="text-white/80">{featuredProperty.sqft} sqft</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-sm">Starting Price</p>
                        <p className="text-white text-2xl">
                          {formatIndianPriceReadable(featuredProperty.currentPrice)}
                        </p>
                      </div>
                      <Button
                        size="lg"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={onLogin}
                      >
                        View Details
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-white/90">{isLoading ? "Loading featured properties..." : "No properties available yet."}</p>
                )}
              </div>

              {/* Navigation Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {featuredProperties.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentFeaturedProperty(index)}
                    className={`transition-all rounded-full ${
                      index === currentFeaturedProperty
                        ? "w-8 h-2 bg-white"
                        : "w-2 h-2 bg-white/50 hover:bg-white/75"
                    }`}
                    aria-label={`Go to property ${index + 1}`}
                  />
                ))}
              </div>

              {/* View More button on the right */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // scroll to property search grid
                    setShowSearch(true);
                    setTimeout(() => document.getElementById('property-search')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                >
                  View More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2>How It Works</h2>
            <p className="text-muted-foreground mt-2">
              Three simple steps to predict your property's value
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-3">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white text-xl">
                1
              </div>
              <h3>Browse Properties</h3>
              <p className="text-muted-foreground">
                Explore our extensive database of properties with detailed information and
                photos.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white text-xl">
                2
              </div>
              <h3>Adjust Timeline</h3>
              <p className="text-muted-foreground">
                Use our interactive slider to see predicted prices from 1 to 10 years in the
                future.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white text-xl">
                3
              </div>
              <h3>Make Decisions</h3>
              <p className="text-muted-foreground">
                Save favorites, compare properties, and make informed investment decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Property Search Section */}
      {showSearch && (
        <section id="property-search" className="py-16 border-t">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <h2>Search Properties</h2>
              <p className="text-muted-foreground">
                Find your perfect property with our advanced search filters
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Property Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <SlidersHorizontal className="w-4 h-4" />
                      More Filters
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1">
                          •
                        </Badge>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4>Advanced Filters</h4>
                          {hasActiveFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFilters}
                              className="h-auto p-1"
                            >
                              Clear all
                            </Button>
                          )}
                        </div>
                        <Separator />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">City</label>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Cities</SelectItem>
                            {uniqueCities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">BHK Type</label>
                        <Select value={bhkFilter} onValueChange={setBhkFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="1BHK">1BHK</SelectItem>
                            <SelectItem value="2BHK">2BHK</SelectItem>
                            <SelectItem value="3BHK">3BHK</SelectItem>
                            <SelectItem value="4BHK">4BHK</SelectItem>
                            <SelectItem value="5BHK+">5BHK+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">Price Range</label>
                        <div className="pt-2">
                          <Slider
                            value={priceRange}
                            onValueChange={setPriceRange}
                            min={0}
                            max={MAX_PRICE}
                            step={500000}
                            className="w-full"
                          />
                          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                            <span>Rs {(priceRange[0] / 100000).toFixed(0)}L</span>
                            <span>Rs {(priceRange[1] / 100000).toFixed(0)}L</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">Minimum Bedrooms</label>
                        <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">Minimum Bathrooms</label>
                        <Select value={bathroomFilter} onValueChange={setBathroomFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] flex-1 sm:flex-none">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="appreciation">Best Appreciation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Total Properties</p>
                <p className="text-2xl">{stats.totalProperties}</p>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Average Price</p>
                <p className="text-2xl">{stats.averagePriceFormatted}</p>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Avg. Appreciation</p>
                <p className="text-2xl">{stats.averageAppreciation}%</p>
              </div>
            </div>

            {/* Property Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProperties.slice(0, 6).map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  isFavorite={favoriteIds.has(property.id)}
                  onToggleFavorite={toggleFavorite}
                  isComparing={compareIds.has(property.id)}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>

            {filteredProperties.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No properties found matching your criteria.
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="mt-4">
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            {filteredProperties.length > 6 && (
              <div className="text-center mt-8">
                <Button onClick={onGetStarted} size="lg" className="gap-2">
                  View All {filteredProperties.length} Properties
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Benefits Section */}
      <section className="py-16 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2>Smart Features for Smart Investors</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">Interactive Price Slider</h3>
                  <p className="text-muted-foreground">
                    Adjust the timeline from 1 to 10 years and see predicted property values
                    in real-time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">Advanced Filtering</h3>
                  <p className="text-muted-foreground">
                    Filter by price, location, BHK type, bedrooms, bathrooms, and more.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">Save Favorites</h3>
                  <p className="text-muted-foreground">
                    Create an account to save your favorite properties and track them over
                    time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">AI Chatbot Assistance</h3>
                  <p className="text-muted-foreground">
                    Get instant answers to your questions with our intelligent chatbot
                    assistant.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">Property Comparison</h3>
                  <p className="text-muted-foreground">
                    Compare up to 4 properties side-by-side to make informed decisions.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">Market Insights</h3>
                  <p className="text-muted-foreground">
                    Access detailed appreciation rates and market trends for each property.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-red-600 to-red-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-white mb-4">Ready to Make Smarter Property Decisions?</h2>
          <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
            Join thousands of investors who trust BROkar for accurate property predictions and
            market insights.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={isLoggedIn ? undefined : onLogin}
              disabled={isLoggedIn}
              className="gap-2 bg-white text-red-600 hover:bg-red-50"
            >
              {isLoggedIn ? "Already logged in!" : (
                <>
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setShowSearch(true);
                document
                  .getElementById("property-search")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="gap-2 border-white text-black hover:bg-red-700"
            >
              <Search className="w-5 h-5" />
              Browse Properties
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t -mx-4 md:-mx-6 px-4 md:px-6 mt-6">
        <div className="text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl font-bold text-red-600">BRO</span>
            <span className="text-xl text-black dark:text-white">kar</span>
          </div>
          <p className="text-sm">
            AI-Powered Property Price Predictions © 2025. Making real estate investment
            smarter.
          </p>
        </div>
      </footer>
    </>
  );
}